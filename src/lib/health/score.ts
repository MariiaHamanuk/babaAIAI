import type {
  Call,
  EmailThread,
  Health,
  HealthFactor,
  Project,
} from "../types";

export const WEIGHTS = {
  budgetVsTimeline: 0.25,
  promisedVsDelivered: 0.2,
  callsSentiment: 0.15,
  emailSentiment: 0.1,
  momentum: 0.15,
  staleness: 0.15,
} as const;

const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));

const sentimentToUnit = (score?: number) =>
  // -1..1 → 0..1
  score === undefined ? 0.5 : clamp((score + 1) / 2);

type Inputs = {
  project: Project;
  recentCalls: Call[];
  emailThreads: EmailThread[];
  lastContactAt: string; // ISO
  asOf: Date;
};

export function deriveSignals(input: Inputs): Record<
  HealthFactor["name"],
  number
> {
  const { project, recentCalls, emailThreads, lastContactAt, asOf } = input;

  // 1. budgetVsTimeline: penalize when burn outpaces timeline burn.
  const totalDays =
    (new Date(project.timeline.due).getTime() -
      new Date(project.timeline.start).getTime()) /
    86_400_000;
  const elapsedDays =
    (asOf.getTime() - new Date(project.timeline.start).getTime()) / 86_400_000;
  const timelineBurn = clamp(elapsedDays / Math.max(totalDays, 1), 0, 1.5);
  const budgetBurn = clamp(
    project.loggedHours / Math.max(project.budgetedHours, 1),
    0,
    1.5,
  );
  const overrun = Math.max(0, budgetBurn - timelineBurn); // 0 = matched, >0 = over
  const budgetVsTimeline = clamp(1 - overrun * 2);

  // 2. promisedVsDelivered: how much we shipped vs what timeline expects.
  // expected fraction of done = timelineBurn (linear assumption)
  // actual = donePoints / committedPoints
  const deliveredFraction =
    project.donePoints / Math.max(project.committedPoints, 1);
  const expectedFraction = clamp(timelineBurn, 0, 1);
  const promisedVsDelivered =
    expectedFraction === 0
      ? 1 // brand-new project: don't penalize
      : clamp(deliveredFraction / expectedFraction);

  // 3. callsSentiment: average across recent calls
  const callScores = recentCalls
    .map((c) => c.sentiment?.score)
    .filter((s): s is number => typeof s === "number");
  const callsSentiment =
    callScores.length === 0
      ? 0.5
      : sentimentToUnit(
          callScores.reduce((a, b) => a + b, 0) / callScores.length,
        );

  // 4. emailSentiment: same shape
  const emailScores = emailThreads
    .map((e) => e.sentiment?.score)
    .filter((s): s is number => typeof s === "number");
  const emailSentiment =
    emailScores.length === 0
      ? 0.5
      : sentimentToUnit(
          emailScores.reduce((a, b) => a + b, 0) / emailScores.length,
        );

  // 5. momentum: 7-day activity ratio vs 30-day baseline.
  const within = (iso: string, days: number) =>
    asOf.getTime() - new Date(iso).getTime() <= days * 86_400_000;
  const recent7 =
    recentCalls.filter((c) => within(c.date, 7)).length +
    emailThreads.filter((e) => within(e.date, 7)).length;
  const recent30 =
    recentCalls.filter((c) => within(c.date, 30)).length +
    emailThreads.filter((e) => within(e.date, 30)).length;
  // Healthy momentum: 7-day activity ≥ 7/30 of 30-day baseline.
  const expectedRecent = (recent30 * 7) / 30;
  const ratio =
    expectedRecent === 0
      ? recent7 > 0
        ? 1
        : 0
      : recent7 / Math.max(expectedRecent, 0.5);
  const momentum = clamp(ratio / 1.5);

  // 6. staleness: penalize gaps in contact.
  const daysSince =
    (asOf.getTime() - new Date(lastContactAt).getTime()) / 86_400_000;
  const staleness = clamp(1 - daysSince / 30);

  return {
    budgetVsTimeline,
    promisedVsDelivered,
    callsSentiment,
    emailSentiment,
    momentum,
    staleness,
  };
}

export function deriveFlags(
  signals: Record<HealthFactor["name"], number>,
  input: Inputs,
): string[] {
  const flags: string[] = [];
  const daysSince =
    (input.asOf.getTime() - new Date(input.lastContactAt).getTime()) /
    86_400_000;

  if (signals.budgetVsTimeline < 0.6) flags.push("budget-overrun");
  if (signals.promisedVsDelivered < 0.7) flags.push("behind-on-promises");
  if (signals.callsSentiment < 0.4) flags.push("negative-call-sentiment");
  if (signals.emailSentiment < 0.4) flags.push("negative-email-sentiment");
  if (daysSince >= 21) flags.push("no-recent-contact");
  if (signals.momentum < 0.4) flags.push("declining-momentum");

  // Risk language flags from sentiment
  const calls = input.recentCalls.flatMap((c) => c.sentiment?.riskFlags ?? []);
  const emails = input.emailThreads.flatMap(
    (e) => e.sentiment?.riskFlags ?? [],
  );
  const allRisks = new Set([...calls, ...emails]);
  if (allRisks.has("escalation")) flags.push("escalation-risk");
  if (allRisks.has("churn_risk")) flags.push("churn-risk");

  return flags;
}

export function computeHealth(input: Inputs): Health {
  const signals = deriveSignals(input);
  const factors: HealthFactor[] = (
    Object.entries(WEIGHTS) as [HealthFactor["name"], number][]
  ).map(([name, weight]) => ({
    name,
    value: signals[name],
    weight,
    contribution: signals[name] * weight * 100,
  }));
  const score = Math.round(factors.reduce((a, f) => a + f.contribution, 0));
  const band: Health["band"] = score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
  return { score, band, factors, flags: deriveFlags(signals, input) };
}
