import type {
  Call,
  Client,
  Deal,
  EmailThread,
  Health,
  OpportunityItem,
  Progress,
  Project,
  RiskItem,
  TimelineStatus,
  Touchpoint,
} from "../types";

const HUMAN_OPPORTUNITY: Record<
  NonNullable<Call["sentiment"]>["opportunitySignals"][number],
  string
> = {
  expansion: "Expansion",
  reference: "Reference",
  case_study: "Case study",
  renewal: "Renewal",
  upsell: "Upsell",
  advocacy: "Advocacy",
};

const HUMAN_FLAG: Record<string, string> = {
  "budget-overrun": "Budget burn ahead of timeline",
  "behind-on-promises": "Delivery behind plan",
  "negative-call-sentiment": "Recent calls trending negative",
  "negative-email-sentiment": "Email tone trending negative",
  "no-recent-contact": "No client contact recently",
  "declining-momentum": "Activity is decelerating",
  "escalation-risk": "Escalation language detected",
  "churn-risk": "Churn signals in communications",
};

const HUMAN_RISK_FLAG: Record<string, string> = {
  delays: "Delay complaint",
  scope_creep: "Scope creep",
  escalation: "Escalation threat",
  churn_risk: "Churn risk",
  budget_pressure: "Budget pressure",
};

export function deriveTimelineStatus(
  project: Project,
  asOf: Date,
): TimelineStatus {
  const totalDays =
    (new Date(project.timeline.due).getTime() -
      new Date(project.timeline.start).getTime()) /
    86_400_000;
  const elapsed =
    (asOf.getTime() - new Date(project.timeline.start).getTime()) /
    86_400_000;
  const elapsedFrac = elapsed / Math.max(totalDays, 1);
  const deliveredFrac =
    project.donePoints / Math.max(project.committedPoints, 1);

  if (elapsedFrac < 0.05) return "early";
  if (elapsedFrac > 1 && deliveredFrac < 1) return "overdue";
  // Ratio of delivered to expected linear progress.
  const ratio = deliveredFrac / Math.max(elapsedFrac, 0.05);
  if (ratio < 0.6) return "behind";
  if (ratio < 0.85) return "at-risk";
  return "on-track";
}

export function deriveProgress(project: Project, asOf: Date): Progress {
  const totalDays =
    (new Date(project.timeline.due).getTime() -
      new Date(project.timeline.start).getTime()) /
    86_400_000;
  const elapsed =
    (asOf.getTime() - new Date(project.timeline.start).getTime()) /
    86_400_000;
  const elapsedFrac = Math.max(0, Math.min(1, elapsed / Math.max(totalDays, 1)));
  const expected = Math.round(project.committedPoints * elapsedFrac);
  const pct =
    project.committedPoints === 0
      ? 0
      : (project.donePoints / project.committedPoints) * 100;
  return {
    delivered: project.donePoints,
    expected,
    committed: project.committedPoints,
    pct: Math.round(pct),
  };
}

export function deriveLastTouchpoint(
  calls: Call[],
  emails: EmailThread[],
): Touchpoint | null {
  const items: Touchpoint[] = [
    ...calls.map((c) => ({
      type: "call" as const,
      date: c.date,
      summary: c.notes.slice(0, 110) + (c.notes.length > 110 ? "…" : ""),
    })),
    ...emails.map((e) => ({
      type: "email" as const,
      date: e.date,
      summary: `${e.subject} — ${e.snippet.slice(0, 80)}${e.snippet.length > 80 ? "…" : ""}`,
    })),
  ];
  if (items.length === 0) return null;
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items[0];
}

export function deriveRisks(
  calls: Call[],
  emails: EmailThread[],
  health: Health,
  deal: Deal,
  asOf: Date,
): RiskItem[] {
  const items: RiskItem[] = [];

  // From calls
  for (const c of calls) {
    if (!c.sentiment) continue;
    const isNeg =
      c.sentiment.label === "negative" ||
      c.sentiment.label === "very_negative";
    if (!isNeg) continue;
    const severity: RiskItem["severity"] =
      c.sentiment.label === "very_negative" ||
      c.sentiment.riskFlags.includes("escalation") ||
      c.sentiment.riskFlags.includes("churn_risk")
        ? "high"
        : "medium";
    const flagText = c.sentiment.riskFlags
      .map((f) => HUMAN_RISK_FLAG[f] ?? f)
      .join(", ");
    items.push({
      id: `risk-${c.id}`,
      source: "call",
      date: c.date,
      severity,
      description: flagText
        ? `${c.sentiment.rationale} (${flagText})`
        : c.sentiment.rationale,
    });
  }

  // From emails
  for (const e of emails) {
    if (!e.sentiment) continue;
    const isNeg =
      e.sentiment.label === "negative" ||
      e.sentiment.label === "very_negative";
    if (!isNeg) continue;
    const severity: RiskItem["severity"] =
      e.sentiment.label === "very_negative" ||
      e.sentiment.riskFlags.includes("escalation") ||
      e.sentiment.riskFlags.includes("churn_risk")
        ? "high"
        : "medium";
    items.push({
      id: `risk-${e.id}`,
      source: "email",
      date: e.date,
      severity,
      description: `${e.subject}: ${e.sentiment.rationale}`,
    });
  }

  // Computed risks from health.flags (skip ones already covered by sentiment items)
  const sentimentFlags = new Set([
    "negative-call-sentiment",
    "negative-email-sentiment",
  ]);
  for (const flag of health.flags) {
    if (sentimentFlags.has(flag)) continue;
    if (!HUMAN_FLAG[flag]) continue;
    const severity: RiskItem["severity"] =
      flag === "escalation-risk" || flag === "churn-risk"
        ? "high"
        : flag === "no-recent-contact" || flag === "budget-overrun"
          ? "medium"
          : "low";
    items.push({
      id: `risk-flag-${flag}`,
      source: "computed",
      date: deal.lastActivityAt,
      severity,
      description: HUMAN_FLAG[flag],
    });
  }

  // Sort by severity then date desc
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  items.sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity])
      return sevRank[a.severity] - sevRank[b.severity];
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  return items;
}

export function deriveOpportunities(
  calls: Call[],
  emails: EmailThread[],
): OpportunityItem[] {
  const items: OpportunityItem[] = [];

  for (const c of calls) {
    const signals = c.sentiment?.opportunitySignals ?? [];
    if (signals.length === 0) continue;
    const tags = signals.map((s) => HUMAN_OPPORTUNITY[s]).join(", ");
    const rationale = c.sentiment?.rationale;
    items.push({
      id: `opp-${c.id}`,
      source: "call",
      date: c.date,
      description: rationale
        ? `${rationale} (${tags})`
        : `Signals: ${tags}`,
    });
  }
  for (const e of emails) {
    const signals = e.sentiment?.opportunitySignals ?? [];
    if (signals.length === 0) continue;
    const tags = signals.map((s) => HUMAN_OPPORTUNITY[s]).join(", ");
    const rationale = e.sentiment?.rationale;
    items.push({
      id: `opp-${e.id}`,
      source: "email",
      date: e.date,
      description: rationale
        ? `${rationale} (${tags})`
        : `Signals: ${tags}`,
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

export function deriveAll(input: {
  calls: Call[];
  emails: EmailThread[];
  project: Project;
  deal: Deal;
  health: Health;
  asOf: Date;
}): Pick<
  Client,
  "timelineStatus" | "progress" | "risks" | "opportunities" | "lastTouchpoint"
> {
  return {
    timelineStatus: deriveTimelineStatus(input.project, input.asOf),
    progress: deriveProgress(input.project, input.asOf),
    risks: deriveRisks(
      input.calls,
      input.emails,
      input.health,
      input.deal,
      input.asOf,
    ),
    opportunities: deriveOpportunities(input.calls, input.emails),
    lastTouchpoint: deriveLastTouchpoint(input.calls, input.emails),
  };
}
