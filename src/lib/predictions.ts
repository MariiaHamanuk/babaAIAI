import type { Predictions, Project } from "./types";

const DAY_MS = 86_400_000;
const MAX_PCT = 250;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return MAX_PCT;
  return Math.max(0, Math.min(MAX_PCT, Math.round(v)));
}

export function computePredictions(
  project: Project,
  asOf: Date,
): Predictions {
  const start = new Date(project.timeline.start).getTime();
  const due = new Date(project.timeline.due).getTime();
  const totalDays = (due - start) / DAY_MS;
  const daysElapsed = (asOf.getTime() - start) / DAY_MS;
  const elapsedFrac = totalDays > 0 ? daysElapsed / totalDays : 0;
  const daysRemaining = (due - asOf.getTime()) / DAY_MS;

  const insufficient =
    elapsedFrac < 0.15 ||
    project.donePoints === 0 ||
    project.committedPoints === 0;

  if (insufficient) {
    return {
      finalBudgetPct: null,
      finalDeliveryPct: null,
      predictedDoneDate: null,
      daysVsDue: null,
      trendingHealthBand: null,
      summary:
        "Everything is going as planned (not enough data to forecast yet).",
      confidence: "low",
    };
  }

  // Extrapolate current rates to end of project window.
  const burnRatePerDay = project.loggedHours / Math.max(daysElapsed, 0.001);
  const projectedFinalHours = burnRatePerDay * totalDays;
  const finalBudgetPct = clampPct(
    (projectedFinalHours / Math.max(project.budgetedHours, 1)) * 100,
  );

  const pointsPerDay = project.donePoints / Math.max(daysElapsed, 0.001);
  const projectedFinalPoints = pointsPerDay * totalDays;
  // Capped at 100 — you can't deliver more than committed scope.
  // "Ahead of pace" is communicated via predictedDoneDate / daysVsDue instead.
  const finalDeliveryPct = Math.min(
    100,
    clampPct(
      (projectedFinalPoints / Math.max(project.committedPoints, 1)) * 100,
    ),
  );

  // When will all committed points be done at current rate?
  const remainingPoints = Math.max(
    0,
    project.committedPoints - project.donePoints,
  );
  let predictedDoneDate: string | null = null;
  let daysVsDue: number | null = null;
  if (pointsPerDay > 0) {
    const daysToFinish = remainingPoints / pointsPerDay;
    const doneAt = new Date(asOf.getTime() + daysToFinish * DAY_MS);
    predictedDoneDate = doneAt.toISOString();
    daysVsDue = Math.round((doneAt.getTime() - due) / DAY_MS);
  }

  // Trending health band: simplified threshold on projected end-state.
  let trendingHealthBand: "green" | "yellow" | "red" | null = null;
  if (finalBudgetPct > 110 || finalDeliveryPct < 70) {
    trendingHealthBand = "red";
  } else if (finalBudgetPct > 95 || finalDeliveryPct < 90) {
    trendingHealthBand = "yellow";
  } else {
    trendingHealthBand = "green";
  }

  // Confidence rises with elapsed fraction and number of done points.
  const confidence: "low" | "medium" | "high" =
    elapsedFrac > 0.5 && project.donePoints >= 10
      ? "high"
      : elapsedFrac > 0.3
        ? "medium"
        : "low";

  // Build a human summary
  const summary = buildSummary({
    finalBudgetPct,
    finalDeliveryPct,
    daysVsDue,
    predictedDoneDate,
    daysRemaining,
  });

  return {
    finalBudgetPct,
    finalDeliveryPct,
    predictedDoneDate,
    daysVsDue,
    trendingHealthBand,
    summary,
    confidence,
  };
}

function buildSummary({
  finalBudgetPct,
  finalDeliveryPct,
  daysVsDue,
  predictedDoneDate,
  daysRemaining,
}: {
  finalBudgetPct: number;
  finalDeliveryPct: number;
  daysVsDue: number | null;
  predictedDoneDate: string | null;
  daysRemaining: number;
}): string {
  const parts: string[] = [];

  // Budget piece
  if (finalBudgetPct >= 110) {
    parts.push(`will overrun budget by ${finalBudgetPct - 100}%`);
  } else if (finalBudgetPct <= 85) {
    parts.push(`will land under budget at ${finalBudgetPct}%`);
  } else {
    parts.push(`budget projected at ${finalBudgetPct}%`);
  }

  // Schedule piece
  if (predictedDoneDate && daysVsDue !== null) {
    if (daysVsDue <= -3) {
      parts.push(`finish ${Math.abs(daysVsDue)} days early`);
    } else if (daysVsDue >= 3) {
      parts.push(`slip by ${daysVsDue} days`);
    } else {
      parts.push(`finish on schedule (~${fmtDate(predictedDoneDate)})`);
    }
  } else if (daysRemaining < 0) {
    parts.push("project window has elapsed");
  }

  // Delivery piece (only mention when alarming)
  if (finalDeliveryPct < 80) {
    parts.push(`only ${finalDeliveryPct}% of scope projected to land`);
  }

  return `On current pace, ${parts.join(", ")}.`;
}
