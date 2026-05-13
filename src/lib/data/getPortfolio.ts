import { cache } from "../cache";
import { env, useMocks } from "../env";
import { computeHealth } from "../health/score";
import {
  callsFromHubspot,
  dealFromHubspot,
  emailsFromHubspot,
  getHubspotCalls,
  getHubspotDeal,
  getHubspotEmails,
  listHubspotDeals,
} from "../integrations/hubspot";
import { getJiraProject, projectFromJira } from "../integrations/jira";
import { computePredictions } from "../predictions";
import { classifyBatch } from "../ai/sentiment";
import { suggestActionsBatch } from "../ai/actions";
import type {
  Call,
  Client,
  EmailThread,
  PortfolioSnapshot,
  Sentiment,
} from "../types";
import { seedHelpers } from "../../mocks/seed";
import { deriveAll } from "./derive";

const PORTFOLIO_KEY = "portfolio:v1";
const CLIENT_KEY = (id: string) => `client:v1:${id}`;
const TTL = 600;

const asOfNow = () => (useMocks ? seedHelpers.TODAY : new Date());

export type PipelineEmit = (event: {
  type: "status";
  phase: "fetch" | "sentiment" | "actions" | "predict" | "compose";
  message?: string;
  progress?: { done: number; total: number };
}) => void;

const noop: PipelineEmit = () => {};

async function fetchClientRaw(clientId: string) {
  const [dealRaw, callsRaw, emailsRaw] = await Promise.all([
    getHubspotDeal(clientId),
    getHubspotCalls(clientId),
    getHubspotEmails(clientId),
  ]);
  const projRaw = await getJiraProject(
    dealRaw.jiraProjectKey,
    dealRaw.budgetedHours,
  );
  return { dealRaw, callsRaw, emailsRaw, projRaw };
}

function attachSentiment<
  T extends { id: string; sentiment?: Sentiment | undefined },
>(items: T[], sentiments: Map<string, Sentiment>): T[] {
  return items.map((it) => ({ ...it, sentiment: sentiments.get(it.id) }));
}

/**
 * Build the entire portfolio snapshot in one pass with cross-cutting LLM steps.
 *
 *   1. fetch — pull HubSpot + Jira raw shapes for every client
 *   2. sentiment — classify all calls + emails together (batched, one OpenAI client)
 *   3. compose — assemble Client objects with health + derived
 *   4. actions — generate per-client recommendations (batched)
 *   5. predict — deterministic math
 */
async function buildSnapshot(emit: PipelineEmit): Promise<PortfolioSnapshot> {
  const asOf = asOfNow();

  // Phase 1 — Fetch
  emit({ type: "status", phase: "fetch", message: "Fetching deals..." });
  const deals = await listHubspotDeals();
  emit({
    type: "status",
    phase: "fetch",
    message: `Fetched ${deals.length} deals; loading calls/emails/projects...`,
  });

  // Use the deal id verbatim as our clientId — works in both mock and real modes.
  const rawClients = await Promise.all(
    deals.map(async (d) => {
      const raw = await fetchClientRaw(d.id);
      return { clientId: d.id, ...raw };
    }),
  );

  // Phase 2 — Sentiment (one batch across all calls + emails)
  const sentimentInputs: Array<{
    id: string;
    kind: "call" | "email";
    text: string;
  }> = [];
  for (const c of rawClients) {
    for (const call of c.callsRaw) {
      sentimentInputs.push({
        id: call.id,
        kind: "call",
        text: call.notes,
      });
    }
    for (const email of c.emailsRaw) {
      sentimentInputs.push({
        id: email.id,
        kind: "email",
        text: `${email.subject}\n${email.snippet}`,
      });
    }
  }
  emit({
    type: "status",
    phase: "sentiment",
    message: `Classifying ${sentimentInputs.length} communications`,
    progress: { done: 0, total: sentimentInputs.length },
  });
  const sentiments = await classifyBatch(sentimentInputs, ({ done, total }) =>
    emit({
      type: "status",
      phase: "sentiment",
      progress: { done, total },
    }),
  );

  // Phase 3 — Compose with sentiment attached
  const clientsBeforeActions: Array<Omit<Client, "nextActions" | "predictions">> =
    rawClients.map((r) => {
      const deal = dealFromHubspot(r.dealRaw);
      const calls: Call[] = attachSentiment(
        callsFromHubspot(r.callsRaw),
        sentiments,
      );
      const emails: EmailThread[] = attachSentiment(
        emailsFromHubspot(r.emailsRaw),
        sentiments,
      );
      const project = projectFromJira(r.projRaw);
      const health = computeHealth({
        project,
        recentCalls: calls,
        emailThreads: emails,
        lastContactAt: deal.lastActivityAt,
        asOf,
      });
      const derived = deriveAll({
        calls,
        emails,
        project,
        deal,
        health,
        asOf,
      });
      return {
        id: r.clientId,
        name: r.dealRaw.companyName,
        domain: r.dealRaw.companyDomain,
        industry: r.dealRaw.industry,
        deal,
        project,
        recentCalls: calls,
        emailThreads: emails,
        health,
        ...derived,
      };
    });

  // Phase 4 — Next actions (batched)
  emit({
    type: "status",
    phase: "actions",
    message: `Generating actions for ${clientsBeforeActions.length} clients`,
    progress: { done: 0, total: clientsBeforeActions.length },
  });
  const actionsMap = await suggestActionsBatch(
    clientsBeforeActions,
    ({ done, total, clientName }) =>
      emit({
        type: "status",
        phase: "actions",
        message: `Actions for ${clientName}`,
        progress: { done, total },
      }),
  );

  // Phase 5 — Predictions (cheap, deterministic)
  emit({
    type: "status",
    phase: "predict",
    message: "Computing forecasts",
  });

  const clients: Client[] = clientsBeforeActions.map((c) => ({
    ...c,
    nextActions: actionsMap.get(c.id) ?? [],
    predictions: computePredictions(c.project, asOf),
  }));

  const atRisk = clients.filter((c) => c.health.band !== "green").length;
  const avgHealth = Math.round(
    clients.reduce((a, c) => a + c.health.score, 0) /
      Math.max(clients.length, 1),
  );
  const pipeline = clients.reduce((a, c) => a + c.deal.amount, 0);

  return {
    generatedAt: new Date().toISOString(),
    clients,
    totals: {
      clients: clients.length,
      atRisk,
      avgHealth,
      pipeline,
    },
    hubspotPortalId: env.HUBSPOT_PORTAL_ID,
  };
}

function emptySnapshot(): PortfolioSnapshot {
  return {
    generatedAt: new Date(0).toISOString(),
    clients: [],
    totals: { clients: 0, atRisk: 0, avgHealth: 0, pipeline: 0 },
  };
}

/**
 * Page-load + SWR fetcher. Cache-only — never triggers a rebuild.
 * Returns an empty snapshot if there's nothing cached yet.
 */
export async function getPortfolio(): Promise<PortfolioSnapshot> {
  const cached = await cache.get<PortfolioSnapshot>(PORTFOLIO_KEY);
  return cached ?? emptySnapshot();
}

/**
 * Refresh-button-only. Runs the full pipeline and emits progress.
 */
export async function runRefresh(
  emit: PipelineEmit = noop,
): Promise<PortfolioSnapshot> {
  const snapshot = await buildSnapshot(emit);
  await cache.set(PORTFOLIO_KEY, snapshot, TTL);
  for (const c of snapshot.clients) {
    await cache.set(CLIENT_KEY(c.id), c, TTL);
  }
  return snapshot;
}

export async function getClient(clientId: string): Promise<Client | null> {
  const cached = await cache.get<Client>(CLIENT_KEY(clientId));
  if (cached) return cached;
  // Cache miss: do NOT rebuild. Caller can ask the user to click Refresh.
  return null;
}

export async function bustPortfolioCache(): Promise<void> {
  await cache.delete(PORTFOLIO_KEY);
}
