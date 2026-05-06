export type DealStage =
  | "Qualified"
  | "Negotiation"
  | "Contract Sent"
  | "Closed Won"
  | "Closed Lost";

export type Sentiment = {
  score: number; // -1..1
  label: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  dominantEmotion:
    | "frustrated"
    | "concerned"
    | "neutral"
    | "satisfied"
    | "enthusiastic";
  riskFlags: Array<
    "delays" | "scope_creep" | "escalation" | "churn_risk" | "budget_pressure"
  >;
  opportunitySignals: Array<
    | "expansion"
    | "reference"
    | "case_study"
    | "renewal"
    | "upsell"
    | "advocacy"
  >;
  rationale: string;
};

export type Call = {
  id: string;
  date: string; // ISO
  durationMin: number;
  participants: string[];
  notes: string;
  sentiment?: Sentiment;
};

export type EmailThread = {
  id: string;
  date: string;
  subject: string;
  snippet: string;
  sentiment?: Sentiment;
};

export type Deal = {
  id: string;
  amount: number;
  stage: DealStage;
  ownerEmail: string;
  lastActivityAt: string; // ISO
  startedAt: string;
};

export type SprintStatus = "completed" | "current" | "upcoming";

export type Sprint = {
  name: string;
  number: number;
  start: string;
  end: string;
  status: SprintStatus;
  committedPoints: number;
  completedPoints: number;
  tasksPlanned: number;
  tasksCompleted: number;
};

export type Project = {
  jiraKey: string;
  budgetedHours: number;
  loggedHours: number;
  committedPoints: number;
  donePoints: number;
  timeline: { start: string; due: string };
  burnSeries: Array<{
    day: string;
    budgetPct: number;
    timelinePct: number;
    outputPct: number;
  }>;
  todayLabel: string; // matching label inside burnSeries to anchor a "today" line
  sprints: Sprint[];
  currentSprint: Sprint;
};

export type TimelineStatus =
  | "early"
  | "on-track"
  | "at-risk"
  | "behind"
  | "overdue";

export type RiskItem = {
  id: string;
  source: "call" | "email" | "computed";
  date: string;
  severity: "high" | "medium" | "low";
  description: string;
};

export type OpportunityItem = {
  id: string;
  source: "call" | "email";
  date: string;
  description: string;
};

export type Touchpoint = {
  type: "call" | "email";
  date: string;
  summary: string;
};

export type Progress = {
  delivered: number; // donePoints
  expected: number; // expected by now (timeline-linear)
  committed: number; // total committed
  pct: number; // delivered / committed * 100
};

export type HealthFactor = {
  name:
    | "budgetVsTimeline"
    | "promisedVsDelivered"
    | "callsSentiment"
    | "emailSentiment"
    | "momentum"
    | "staleness";
  value: number; // 0..1
  weight: number;
  contribution: number; // value * weight * 100
};

export type Health = {
  score: number; // 0..100
  band: "green" | "yellow" | "red";
  factors: HealthFactor[];
  flags: string[]; // human-readable, e.g. "no-recent-contact"
};

export type NextAction = {
  priority: "high" | "medium" | "low";
  description: string;
  reason: string;
};

export type Predictions = {
  finalBudgetPct: number | null; // projected budget consumption at project end
  finalDeliveryPct: number | null; // projected delivery completion at project end
  predictedDoneDate: string | null; // ISO date
  daysVsDue: number | null; // negative = early, positive = late
  trendingHealthBand: "green" | "yellow" | "red" | null;
  summary: string;
  confidence: "low" | "medium" | "high";
};

export type Client = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  deal: Deal;
  project: Project;
  recentCalls: Call[];
  emailThreads: EmailThread[];
  health: Health;
  nextActions: NextAction[];
  timelineStatus: TimelineStatus;
  progress: Progress;
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  lastTouchpoint: Touchpoint | null;
  predictions: Predictions;
};

export type PortfolioSnapshot = {
  generatedAt: string;
  clients: Client[];
  totals: {
    clients: number;
    atRisk: number;
    avgHealth: number;
    pipeline: number;
  };
};
