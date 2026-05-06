/**
 * Real HubSpot CRM v3 adapter.
 *
 * In mode="mock-api" each request is intercepted and a HubSpot-shaped
 * response is synthesized from src/mocks/seed.ts. In mode="real" the same
 * calls are made via fetch().
 *
 * Endpoints used:
 *   GET  /crm/v3/objects/deals?properties=...&associations=companies            (list deals, paginated)
 *   GET  /crm/v3/objects/deals/{id}?properties=...&associations=companies       (single deal)
 *   GET  /crm/v3/objects/companies/{id}?properties=name,domain,industry
 *   GET  /crm/v3/owners/{id}                                                    (owner email)
 *   GET  /crm/v3/objects/deals/{id}/associations/{calls|emails}                 (associated IDs)
 *   POST /crm/v3/objects/{calls|emails}/batch/read                              (batch fetch full objects)
 *   GET  /crm/v3/pipelines/deals                                                (stage label map)
 */
import { env, integrationsMode } from "../env";
import { SCENARIOS, seedHelpers } from "../../mocks/seed";
import type {
  HubspotCallShape,
  HubspotDealShape,
  HubspotEmailShape,
} from "./hubspot";
import type { Deal } from "../types";

/* ============================================================================
 * Real-API response shapes
 * ========================================================================= */

type HsObject<P = Record<string, unknown>> = {
  id: string;
  properties: P;
  associations?: {
    companies?: { results: Array<{ id: string }> };
  };
};

type HsList<T> = { results: T[]; paging?: { next?: { after: string } } };

type HsAssociationRef = { toObjectId?: string; id?: string; type?: string };

type HsBatchReadResponse<P> = {
  status?: string;
  results: Array<HsObject<P>>;
};

type HsDealProps = {
  amount?: string;
  dealstage?: string;
  createdate?: string;
  hs_lastmodifieddate?: string;
  notes_last_contacted?: string | null;
  hubspot_owner_id?: string | null;
  budget_hours?: string | null;
  jira_project_key?: string | null;
};

type HsCompanyProps = {
  name?: string;
  domain?: string;
  industry?: string;
};

type HsOwner = { id: string; email: string };

type HsCallProps = {
  hs_timestamp?: string;
  hs_call_body?: string;
  hs_call_duration?: string; // ms (per HubSpot docs)
};

type HsEmailProps = {
  hs_timestamp?: string;
  hs_email_subject?: string;
  hs_email_text?: string;
};

type HsPipelinesResponse = {
  results: Array<{
    id: string;
    label?: string;
    stages: Array<{ id: string; label: string }>;
  }>;
};

/* ============================================================================
 * Transport
 * ========================================================================= */

const HS_BASE = "https://api.hubapi.com";

function hsHeaders(): Record<string, string> {
  if (!env.HUBSPOT_ACCESS_TOKEN)
    throw new Error("HUBSPOT_ACCESS_TOKEN required for real mode");
  return {
    Authorization: `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function fetchOrSynth<T>(path: string, synth: () => T): Promise<T> {
  if (integrationsMode === "real") {
    const res = await fetch(`${HS_BASE}${path}`, { headers: hsHeaders() });
    if (!res.ok)
      throw new Error(
        `HubSpot GET ${path}: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }
  return synth();
}

async function postOrSynth<T>(
  path: string,
  body: unknown,
  synth: () => T,
): Promise<T> {
  if (integrationsMode === "real") {
    const res = await fetch(`${HS_BASE}${path}`, {
      method: "POST",
      headers: hsHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(
        `HubSpot POST ${path}: ${res.status} ${await res.text()}`,
      );
    return res.json();
  }
  return synth();
}

/* ============================================================================
 * Synth — build HubSpot-shaped payloads from seed
 * ========================================================================= */

const dealStageId: Record<Deal["stage"], string> = {
  Qualified: "qualifiedtobuy",
  Negotiation: "decisionmakerboughtin",
  "Contract Sent": "contractsent",
  "Closed Won": "closedwon",
  "Closed Lost": "closedlost",
};

function dealIdFor(scenarioId: string) {
  return `deal-${scenarioId}`;
}

function companyIdFor(scenarioId: string) {
  return `company-${scenarioId}`;
}

function ownerIdFor(email: string) {
  return `owner-${email.split("@")[0]}`;
}

function synthDealList(): HsList<HsObject<HsDealProps>> {
  const results = SCENARIOS.map((s) => ({
    id: dealIdFor(s.id),
    properties: {
      amount: String(s.deal.amount),
      dealstage: dealStageId[s.deal.stage],
      createdate: seedHelpers.daysAgo(s.deal.startedDaysAgo),
      hs_lastmodifieddate: seedHelpers.daysAgo(s.cadence.lastContactDaysAgo),
      notes_last_contacted: seedHelpers.daysAgo(s.cadence.lastContactDaysAgo),
      hubspot_owner_id: ownerIdFor(s.ownerEmail),
      budget_hours: String(s.project.budgetedHours),
      jira_project_key: s.project.jiraKey,
    },
    associations: {
      companies: { results: [{ id: companyIdFor(s.id) }] },
    },
  }));
  return { results };
}

function synthDeal(dealId: string): HsObject<HsDealProps> {
  const list = synthDealList().results;
  const found = list.find((d) => d.id === dealId);
  if (!found) throw new Error(`Unknown deal: ${dealId}`);
  return found;
}

function synthCompany(companyId: string): HsObject<HsCompanyProps> {
  const sId = companyId.replace(/^company-/, "");
  const s = SCENARIOS.find((x) => x.id === sId);
  if (!s) throw new Error(`Unknown company: ${companyId}`);
  return {
    id: companyId,
    properties: {
      name: s.name,
      domain: s.domain,
      industry: s.industry,
    },
  };
}

function synthOwner(ownerId: string): HsOwner {
  const username = ownerId.replace(/^owner-/, "");
  const s = SCENARIOS.find((x) => x.ownerEmail.startsWith(username + "@"));
  return { id: ownerId, email: s?.ownerEmail ?? `${username}@studio.test` };
}

function synthCallAssociations(dealId: string) {
  const sId = dealId.replace(/^deal-/, "");
  const s = SCENARIOS.find((x) => x.id === sId);
  if (!s) return { results: [] };
  return {
    results: s.calls.map((_, i) => ({
      toObjectId: `call-${s.id}-${i}`,
      type: "deal_to_call",
    })),
  };
}

function synthEmailAssociations(dealId: string) {
  const sId = dealId.replace(/^deal-/, "");
  const s = SCENARIOS.find((x) => x.id === sId);
  if (!s) return { results: [] };
  return {
    results: s.emails.map((_, i) => ({
      toObjectId: `email-${s.id}-${i}`,
      type: "deal_to_email",
    })),
  };
}

function synthCallsBatch(ids: string[]): HsBatchReadResponse<HsCallProps> {
  const allCalls: HsObject<HsCallProps>[] = [];
  for (const s of SCENARIOS) {
    s.calls.forEach((c, i) => {
      allCalls.push({
        id: `call-${s.id}-${i}`,
        properties: {
          hs_timestamp: seedHelpers.daysAgo(c.daysAgo),
          hs_call_body: c.notes,
          hs_call_duration: String((25 + (i % 3) * 10) * 60_000),
        },
      });
    });
  }
  return {
    results: allCalls.filter((c) => ids.includes(c.id)),
  };
}

function synthEmailsBatch(ids: string[]): HsBatchReadResponse<HsEmailProps> {
  const allEmails: HsObject<HsEmailProps>[] = [];
  for (const s of SCENARIOS) {
    s.emails.forEach((e, i) => {
      allEmails.push({
        id: `email-${s.id}-${i}`,
        properties: {
          hs_timestamp: seedHelpers.daysAgo(e.daysAgo),
          hs_email_subject: e.subject,
          hs_email_text: e.snippet,
        },
      });
    });
  }
  return {
    results: allEmails.filter((e) => ids.includes(e.id)),
  };
}

function synthPipelines(): HsPipelinesResponse {
  return {
    results: [
      {
        id: "default",
        label: "Sales Pipeline",
        stages: [
          { id: "qualifiedtobuy", label: "Qualified to Buy" },
          { id: "decisionmakerboughtin", label: "Negotiation" },
          { id: "contractsent", label: "Contract Sent" },
          { id: "closedwon", label: "Closed Won" },
          { id: "closedlost", label: "Closed Lost" },
        ],
      },
    ],
  };
}

/* ============================================================================
 * Pipeline stage map — fetched once, cached for the process lifetime
 * ========================================================================= */

let stageMapCache: Map<string, Deal["stage"]> | null = null;

const STAGE_LABEL_TO_OUR_STAGE: Array<{ pattern: RegExp; stage: Deal["stage"] }> = [
  { pattern: /lost|closed[\s-]*lost/i, stage: "Closed Lost" },
  { pattern: /won|closed[\s-]*won/i, stage: "Closed Won" },
  { pattern: /contract|signed|sent/i, stage: "Contract Sent" },
  { pattern: /negotiat|decision|propos/i, stage: "Negotiation" },
  { pattern: /qualif|appoint|presentation|discovery/i, stage: "Qualified" },
];

function classifyStageLabel(label: string): Deal["stage"] {
  for (const m of STAGE_LABEL_TO_OUR_STAGE) {
    if (m.pattern.test(label)) return m.stage;
  }
  return "Qualified"; // safest default for "in pipeline" stages
}

async function getStageMap(): Promise<Map<string, Deal["stage"]>> {
  if (stageMapCache) return stageMapCache;
  const r = await fetchOrSynth<HsPipelinesResponse>(
    "/crm/v3/pipelines/deals",
    () => synthPipelines(),
  );
  const map = new Map<string, Deal["stage"]>();
  for (const pipeline of r.results) {
    for (const stage of pipeline.stages) {
      map.set(stage.id, classifyStageLabel(stage.label));
    }
  }
  stageMapCache = map;
  return map;
}

/* ============================================================================
 * Pagination helper
 * ========================================================================= */

async function paginate<T>(
  buildPath: (after?: string) => string,
  synth: () => HsList<T>,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined = undefined;
  for (let i = 0; i < 50; i++) {
    const synthFn = (): HsList<T> =>
      i === 0 ? synth() : { results: [] };
    const page: HsList<T> = await fetchOrSynth<HsList<T>>(
      buildPath(after),
      synthFn,
    );
    all.push(...page.results);
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return all;
}

/* ============================================================================
 * Real adapter — same code path for mock-api and real
 * ========================================================================= */

const ownerCache = new Map<string, string>();
async function getOwnerEmail(ownerId: string): Promise<string> {
  if (ownerCache.has(ownerId)) return ownerCache.get(ownerId)!;
  const r = await fetchOrSynth<HsOwner>(
    `/crm/v3/owners/${encodeURIComponent(ownerId)}`,
    () => synthOwner(ownerId),
  );
  ownerCache.set(ownerId, r.email);
  return r.email;
}

async function getCompany(companyId: string) {
  return fetchOrSynth<HsObject<HsCompanyProps>>(
    `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=name,domain,industry`,
    () => synthCompany(companyId),
  );
}

const DEAL_PROPERTIES = [
  "amount",
  "dealstage",
  "createdate",
  "hs_lastmodifieddate",
  "notes_last_contacted",
  "hubspot_owner_id",
  "budget_hours",
  "jira_project_key",
];

async function listDealsRaw(): Promise<HsObject<HsDealProps>[]> {
  return paginate<HsObject<HsDealProps>>(
    (after) => {
      const params = new URLSearchParams({
        limit: "100",
        associations: "companies",
        properties: DEAL_PROPERTIES.join(","),
      });
      if (after) params.set("after", after);
      return `/crm/v3/objects/deals?${params.toString()}`;
    },
    () => synthDealList(),
  );
}

async function getDealRaw(dealId: string): Promise<HsObject<HsDealProps>> {
  const params = new URLSearchParams({
    associations: "companies",
    properties: DEAL_PROPERTIES.join(","),
  });
  return fetchOrSynth<HsObject<HsDealProps>>(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?${params.toString()}`,
    () => synthDeal(dealId),
  );
}

async function listAssociations(
  dealId: string,
  kind: "calls" | "emails",
): Promise<string[]> {
  const r = await fetchOrSynth<HsList<HsAssociationRef>>(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}/associations/${kind}`,
    () => (kind === "calls" ? synthCallAssociations(dealId) : synthEmailAssociations(dealId)),
  );
  return r.results
    .map((x) => x.toObjectId ?? x.id)
    .filter((x): x is string => Boolean(x));
}

async function batchReadCalls(
  ids: string[],
): Promise<HsObject<HsCallProps>[]> {
  if (ids.length === 0) return [];
  const r = await postOrSynth<HsBatchReadResponse<HsCallProps>>(
    "/crm/v3/objects/calls/batch/read",
    {
      properties: ["hs_timestamp", "hs_call_body", "hs_call_duration"],
      inputs: ids.map((id) => ({ id })),
    },
    () => synthCallsBatch(ids),
  );
  return r.results;
}

async function batchReadEmails(
  ids: string[],
): Promise<HsObject<HsEmailProps>[]> {
  if (ids.length === 0) return [];
  const r = await postOrSynth<HsBatchReadResponse<HsEmailProps>>(
    "/crm/v3/objects/emails/batch/read",
    {
      properties: ["hs_timestamp", "hs_email_subject", "hs_email_text"],
      inputs: ids.map((id) => ({ id })),
    },
    () => synthEmailsBatch(ids),
  );
  return r.results;
}

async function dealRawToShape(
  d: HsObject<HsDealProps>,
): Promise<HubspotDealShape> {
  const companyId = d.associations?.companies?.results?.[0]?.id;
  const company = companyId
    ? await getCompany(companyId)
    : { properties: { name: "Unknown", domain: "", industry: "Unknown" } };
  const ownerEmail = d.properties.hubspot_owner_id
    ? await getOwnerEmail(d.properties.hubspot_owner_id)
    : "unknown@studio.test";
  if (!d.properties.budget_hours) {
    throw new Error(
      `Deal ${d.id} is missing required custom property 'budget_hours'`,
    );
  }
  if (!d.properties.jira_project_key) {
    throw new Error(
      `Deal ${d.id} is missing required custom property 'jira_project_key'`,
    );
  }

  const stageMap = await getStageMap();
  const stage: Deal["stage"] = d.properties.dealstage
    ? (stageMap.get(d.properties.dealstage) ?? "Qualified")
    : "Qualified";

  return {
    id: d.id,
    amount: Number(d.properties.amount ?? "0"),
    stage,
    ownerEmail,
    startedAt: d.properties.createdate ?? new Date().toISOString(),
    lastActivityAt:
      d.properties.notes_last_contacted ??
      d.properties.hs_lastmodifieddate ??
      new Date().toISOString(),
    companyName: company.properties.name ?? "Unknown",
    companyDomain: company.properties.domain ?? "",
    industry: company.properties.industry ?? "Unknown",
    budgetedHours: Number(d.properties.budget_hours),
    jiraProjectKey: d.properties.jira_project_key,
  };
}

/* ============================================================================
 * Public adapter functions matching the hubspot.ts contract
 * ========================================================================= */

export async function listDeals(): Promise<HubspotDealShape[]> {
  const raws = await listDealsRaw();
  return Promise.all(raws.map(dealRawToShape));
}

export async function getDeal(dealId: string): Promise<HubspotDealShape> {
  return dealRawToShape(await getDealRaw(dealId));
}

export async function getCalls(dealId: string): Promise<HubspotCallShape[]> {
  const ids = await listAssociations(dealId, "calls");
  const calls = await batchReadCalls(ids);
  return calls.map((c) => ({
    id: c.id,
    date: c.properties.hs_timestamp ?? new Date().toISOString(),
    durationMin: Math.round(
      Number(c.properties.hs_call_duration ?? "0") / 60_000,
    ),
    participants: [],
    notes: stripHtml(c.properties.hs_call_body ?? ""),
  }));
}

export async function getEmails(dealId: string): Promise<HubspotEmailShape[]> {
  const ids = await listAssociations(dealId, "emails");
  const emails = await batchReadEmails(ids);
  return emails.map((e) => ({
    id: e.id,
    date: e.properties.hs_timestamp ?? new Date().toISOString(),
    subject: e.properties.hs_email_subject ?? "(no subject)",
    snippet: stripHtml(e.properties.hs_email_text ?? "").slice(0, 240),
  }));
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
