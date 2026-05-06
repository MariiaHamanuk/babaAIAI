import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { integrationsMode } from "../env";
import { SCENARIOS, seedHelpers } from "../../mocks/seed";
import type { Call, Deal, EmailThread, Sentiment } from "../types";
import * as hsReal from "./hubspot.real";

export type HubspotDealShape = {
  id: string;
  amount: number;
  stage: Deal["stage"];
  ownerEmail: string;
  startedAt: string;
  lastActivityAt: string;
  companyName: string;
  companyDomain: string;
  industry: string;
  // Custom Deal properties (the friend creates these in HubSpot)
  budgetedHours: number;
  jiraProjectKey: string;
};

export type HubspotCallShape = {
  id: string;
  date: string;
  durationMin: number;
  participants: string[];
  notes: string;
};

export type HubspotEmailShape = {
  id: string;
  date: string;
  subject: string;
  snippet: string;
};

type SentimentFixture = {
  calls: Record<string, Sentiment>;
  emails: Record<string, Sentiment>;
};

let cachedFixture: SentimentFixture | null = null;
function loadSentimentFixture(): SentimentFixture {
  if (cachedFixture) return cachedFixture;
  try {
    const raw = readFileSync(
      resolve(process.cwd(), "src/mocks/fixtures/sentiments.json"),
      "utf8",
    );
    cachedFixture = JSON.parse(raw) as SentimentFixture;
  } catch {
    cachedFixture = { calls: {}, emails: {} };
  }
  return cachedFixture;
}

export async function getHubspotDeal(
  clientId: string,
): Promise<HubspotDealShape> {
  if (integrationsMode === "mock-domain") return mockDeal(clientId);
  return hsReal.getDeal(clientId);
}

export async function getHubspotCalls(
  clientId: string,
): Promise<HubspotCallShape[]> {
  if (integrationsMode === "mock-domain") return mockCalls(clientId);
  return hsReal.getCalls(clientId);
}

export async function getHubspotEmails(
  clientId: string,
): Promise<HubspotEmailShape[]> {
  if (integrationsMode === "mock-domain") return mockEmails(clientId);
  return hsReal.getEmails(clientId);
}

export async function listHubspotDeals(): Promise<HubspotDealShape[]> {
  if (integrationsMode === "mock-domain")
    return SCENARIOS.map((s) => mockDeal(s.id));
  return hsReal.listDeals();
}

// In mock-domain mode the clientId is the deal id ("deal-{scenario}");
// strip the prefix to look up the scenario in the seed.
const scenarioIdFromClientId = (id: string) => id.replace(/^deal-/, "");

function mockDeal(clientId: string): HubspotDealShape {
  const s = SCENARIOS.find((x) => x.id === scenarioIdFromClientId(clientId));
  if (!s) throw new Error(`Unknown client: ${clientId}`);
  return {
    id: `deal-${s.id}`,
    amount: s.deal.amount,
    stage: s.deal.stage,
    ownerEmail: s.ownerEmail,
    startedAt: seedHelpers.daysAgo(s.deal.startedDaysAgo),
    lastActivityAt: seedHelpers.daysAgo(s.cadence.lastContactDaysAgo),
    companyName: s.name,
    companyDomain: s.domain,
    industry: s.industry,
    budgetedHours: s.project.budgetedHours,
    jiraProjectKey: s.project.jiraKey,
  };
}

function mockCalls(clientId: string): HubspotCallShape[] {
  const s = SCENARIOS.find((x) => x.id === scenarioIdFromClientId(clientId));
  if (!s) return [];
  return s.calls.map((c, i) => ({
    id: `call-${s.id}-${i}`,
    date: seedHelpers.daysAgo(c.daysAgo),
    durationMin: 25 + (i % 3) * 10,
    participants: c.participants,
    notes: c.notes,
  }));
}

function mockEmails(clientId: string): HubspotEmailShape[] {
  const s = SCENARIOS.find((x) => x.id === scenarioIdFromClientId(clientId));
  if (!s) return [];
  return s.emails.map((e, i) => ({
    id: `email-${s.id}-${i}`,
    date: seedHelpers.daysAgo(e.daysAgo),
    subject: e.subject,
    snippet: e.snippet,
  }));
}

// Convert raw Hubspot shapes into domain types, attaching sentiment from fixture
export function callsFromHubspot(rows: HubspotCallShape[]): Call[] {
  const fx = loadSentimentFixture();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    durationMin: r.durationMin,
    participants: r.participants,
    notes: r.notes,
    sentiment: fx.calls[r.id],
  }));
}

export function emailsFromHubspot(rows: HubspotEmailShape[]): EmailThread[] {
  const fx = loadSentimentFixture();
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    subject: r.subject,
    snippet: r.snippet,
    sentiment: fx.emails[r.id],
  }));
}

export function dealFromHubspot(d: HubspotDealShape): Deal {
  return {
    id: d.id,
    amount: d.amount,
    stage: d.stage,
    ownerEmail: d.ownerEmail,
    startedAt: d.startedAt,
    lastActivityAt: d.lastActivityAt,
  };
}
