import { integrationsMode } from "../env";
import { SCENARIOS, seedHelpers } from "../../mocks/seed";
import type { Project, Sprint, SprintStatus } from "../types";
import { composeJiraProject } from "./jira.real";

/**
 * Real-API-shaped types. Mirrors what Jira REST returns (subset).
 * Real adapter (v0.1) returns the same shape; the data composer is unchanged.
 */
export type JiraSprintShape = {
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

export type JiraProjectShape = {
  key: string;
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
  todayLabel: string;
  sprints: JiraSprintShape[];
  currentSprint: JiraSprintShape;
};

const SPRINT_DAYS = 14;
const POINTS_PER_TASK = 3; // avg task size, used to derive task counts from points

export async function getJiraProject(
  jiraProjectKey: string,
  budgetedHours: number,
): Promise<JiraProjectShape> {
  if (integrationsMode === "mock-domain") {
    return mockProject(jiraProjectKey, budgetedHours);
  }
  // Both mock-api and real route through the parsing layer.
  return composeJiraProject(jiraProjectKey, budgetedHours);
}

function mockProject(
  jiraProjectKey: string,
  _budgetedHours: number,
): JiraProjectShape {
  const s = SCENARIOS.find((x) => x.project.jiraKey === jiraProjectKey);
  if (!s) throw new Error(`Unknown jira project: ${jiraProjectKey}`);

  const startDate = new Date(seedHelpers.daysAgo(s.project.timelineStartDaysAgo));
  const dueDate = new Date(seedHelpers.daysFromNow(s.project.timelineDueDaysFromNow));
  const today = seedHelpers.TODAY;
  const start = startDate.toISOString();
  const due = dueDate.toISOString();
  const budgetedHours = s.project.budgetedHours;

  const totalDays =
    s.project.timelineStartDaysAgo + s.project.timelineDueDaysFromNow;
  const elapsed = s.project.timelineStartDaysAgo;
  const elapsedFrac = elapsed / totalDays;
  const loggedHours = Math.round(
    budgetedHours * elapsedFrac * s.project.burnRate,
  );
  const donePoints = Math.round(
    s.project.committedPoints * elapsedFrac * s.project.completionRate,
  );

  // Burn series: budget vs timeline vs output (% of total committed).
  // Generate evenly spaced points + an explicit point at "today" so the chart
  // can anchor a Today line and Projected zone exactly there.
  const points = 8;
  const rawPoints: Array<{ day: string; fracElapsed: number }> = [];
  for (let i = 0; i <= points; i++) {
    const dayFromStart = (totalDays * i) / points;
    const day = new Date(startDate.getTime() + dayFromStart * 86_400_000)
      .toISOString()
      .slice(0, 10);
    rawPoints.push({ day, fracElapsed: dayFromStart / totalDays });
  }
  const todayLabel = today.toISOString().slice(0, 10);
  const todayInsideRange = elapsedFrac > 0 && elapsedFrac < 1;
  if (
    todayInsideRange &&
    !rawPoints.some((p) => p.day === todayLabel)
  ) {
    const insertIdx = rawPoints.findIndex((p) => p.fracElapsed > elapsedFrac);
    rawPoints.splice(
      insertIdx >= 0 ? insertIdx : rawPoints.length,
      0,
      { day: todayLabel, fracElapsed: elapsedFrac },
    );
  }
  const burnSeries = rawPoints.map((p) => ({
    day: p.day,
    budgetPct: Math.round(Math.min(150, p.fracElapsed * s.project.burnRate * 100)),
    timelinePct: Math.round(p.fracElapsed * 100),
    outputPct: Math.round(
      Math.min(150, p.fracElapsed * s.project.completionRate * 100),
    ),
  }));

  // Sprints: 14-day windows from project start.
  const numSprints = Math.max(1, Math.ceil(totalDays / SPRINT_DAYS));
  const baseCommitted = Math.floor(s.project.committedPoints / numSprints);
  const remainder = s.project.committedPoints - baseCommitted * numSprints;

  const sprints: JiraSprintShape[] = [];
  for (let i = 0; i < numSprints; i++) {
    const sprintStartTs = startDate.getTime() + i * SPRINT_DAYS * 86_400_000;
    const sprintEndTs = Math.min(
      startDate.getTime() + (i + 1) * SPRINT_DAYS * 86_400_000,
      dueDate.getTime(),
    );
    const sStart = new Date(sprintStartTs).toISOString();
    const sEnd = new Date(sprintEndTs).toISOString();

    let status: SprintStatus;
    if (sprintEndTs <= today.getTime()) status = "completed";
    else if (sprintStartTs > today.getTime()) status = "upcoming";
    else status = "current";

    // Last sprint absorbs the rounding remainder.
    const committed = baseCommitted + (i === numSprints - 1 ? remainder : 0);

    let completed = 0;
    if (status === "completed") {
      completed = Math.round(committed * s.project.completionRate);
    } else if (status === "current") {
      const elapsedInSprint = Math.max(
        0,
        Math.min(SPRINT_DAYS, (today.getTime() - sprintStartTs) / 86_400_000),
      );
      completed = Math.round(
        committed * (elapsedInSprint / SPRINT_DAYS) * s.project.completionRate,
      );
    }

    sprints.push({
      name: `${s.project.jiraKey} Sprint ${i + 1}`,
      number: i + 1,
      start: sStart,
      end: sEnd,
      status,
      committedPoints: committed,
      completedPoints: completed,
      tasksPlanned: Math.max(1, Math.round(committed / POINTS_PER_TASK)),
      tasksCompleted: Math.round(completed / POINTS_PER_TASK),
    });
  }

  const currentSprint =
    sprints.find((sp) => sp.status === "current") ??
    sprints[sprints.length - 1];

  return {
    key: s.project.jiraKey,
    budgetedHours,
    loggedHours,
    committedPoints: s.project.committedPoints,
    donePoints,
    timeline: { start, due },
    burnSeries,
    todayLabel,
    sprints,
    currentSprint,
  };
}

export function projectFromJira(j: JiraProjectShape): Project {
  return {
    jiraKey: j.key,
    budgetedHours: j.budgetedHours,
    loggedHours: j.loggedHours,
    committedPoints: j.committedPoints,
    donePoints: j.donePoints,
    timeline: j.timeline,
    burnSeries: j.burnSeries,
    todayLabel: j.todayLabel,
    sprints: j.sprints.map((sp) => ({ ...sp }) satisfies Sprint),
    currentSprint: { ...j.currentSprint } satisfies Sprint,
  };
}
