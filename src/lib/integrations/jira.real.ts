/**
 * Real Jira REST/Agile adapter.
 *
 * In mode="mock-api", every request is intercepted and a realistic Jira-shaped
 * response is synthesized from src/mocks/seed.ts. The parser code below runs
 * unchanged. In mode="real", the same calls are made via fetch().
 *
 * Endpoints used:
 *   GET /rest/api/3/field                              (field discovery)
 *   GET /rest/agile/1.0/board?projectKeyOrId={key}     (board lookup)
 *   GET /rest/agile/1.0/board/{boardId}/sprint?state=* (sprint list)
 *   GET /rest/agile/1.0/sprint/{sprintId}/issue        (sprint issues)
 *   GET /rest/api/3/search?jql=project={key}           (all project issues)
 */
import { env, integrationsMode } from "../env";
import { SCENARIOS, seedHelpers } from "../../mocks/seed";
import type { JiraProjectShape, JiraSprintShape } from "./jira";
import type { SprintStatus } from "../types";

const SPRINT_DAYS = 14;
const POINTS_PER_TASK = 3;

/* ============================================================================
 * Real-API response shapes (subset of what Jira returns)
 * ========================================================================= */

type JiraField = {
  id: string;
  name: string;
  custom: boolean;
};

type JiraBoard = { id: number; name: string; type: string };

type JiraSprintApi = {
  id: number;
  name: string;
  state: "closed" | "active" | "future";
  startDate?: string;
  endDate?: string;
  completeDate?: string;
};

type JiraIssueApi = {
  id: string;
  key: string;
  fields: {
    status: { name: string; statusCategory: { key: string } };
    timespent?: number | null; // seconds
    [storyPointsField: string]: unknown;
  };
};

type JiraSearchResponse = {
  issues: JiraIssueApi[];
  nextPageToken?: string;
};

type JiraSprintIssuesResponse = { issues: JiraIssueApi[] };
type JiraSprintListResponse = { values: JiraSprintApi[]; isLast: boolean };
type JiraBoardListResponse = { values: JiraBoard[] };

/* ============================================================================
 * Transport: fetch in real mode, synth in mock-api mode
 * ========================================================================= */

function jiraHeaders(): Record<string, string> {
  if (!env.JIRA_EMAIL || !env.JIRA_API_TOKEN) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN required for real mode");
  }
  const auth = Buffer.from(
    `${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`,
  ).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };
}

async function fetchOrSynth<T>(
  path: string,
  synth: () => T,
): Promise<T> {
  if (integrationsMode === "real") {
    if (!env.JIRA_BASE_URL) throw new Error("JIRA_BASE_URL required");
    const res = await fetch(env.JIRA_BASE_URL + path, {
      headers: jiraHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Jira ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }
  // mock-api
  return synth();
}

/* ============================================================================
 * Synth helpers — build real-API-shaped responses from seed.ts
 * ========================================================================= */

const STORY_POINTS_FIELD_ID = "customfield_10016";

function synthFields(): JiraField[] {
  return [
    { id: "summary", name: "Summary", custom: false },
    { id: "status", name: "Status", custom: false },
    { id: "timespent", name: "Time Spent", custom: false },
    { id: STORY_POINTS_FIELD_ID, name: "Story Points", custom: true },
  ];
}

function synthBoardForProject(jiraKey: string): JiraBoardListResponse {
  return {
    values: [{ id: hashKey(jiraKey, 1000), name: `${jiraKey} board`, type: "scrum" }],
  };
}

function hashKey(s: string, mod = 1000): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % mod;
}

// Sprint state mapping
function synthSprintsForProject(jiraKey: string): JiraSprintListResponse {
  const s = SCENARIOS.find((x) => x.project.jiraKey === jiraKey);
  if (!s) return { values: [], isLast: true };

  const startDate = new Date(seedHelpers.daysAgo(s.project.timelineStartDaysAgo));
  const dueDate = new Date(seedHelpers.daysFromNow(s.project.timelineDueDaysFromNow));
  const today = seedHelpers.TODAY;
  const totalDays =
    s.project.timelineStartDaysAgo + s.project.timelineDueDaysFromNow;
  const numSprints = Math.max(1, Math.ceil(totalDays / SPRINT_DAYS));

  const values: JiraSprintApi[] = [];
  for (let i = 0; i < numSprints; i++) {
    const sprintStart = new Date(startDate.getTime() + i * SPRINT_DAYS * 86_400_000);
    const sprintEnd = new Date(
      Math.min(
        startDate.getTime() + (i + 1) * SPRINT_DAYS * 86_400_000,
        dueDate.getTime(),
      ),
    );
    let state: JiraSprintApi["state"];
    if (sprintEnd.getTime() <= today.getTime()) state = "closed";
    else if (sprintStart.getTime() > today.getTime()) state = "future";
    else state = "active";

    const sprint: JiraSprintApi = {
      id: hashKey(`${jiraKey}-${i + 1}`, 1_000_000),
      name: `${jiraKey} Sprint ${i + 1}`,
      state,
      startDate: sprintStart.toISOString(),
      endDate: sprintEnd.toISOString(),
    };
    if (state === "closed") sprint.completeDate = sprintEnd.toISOString();
    values.push(sprint);
  }
  return { values, isLast: true };
}

function synthSprintIssues(sprintId: number): JiraSprintIssuesResponse {
  // Find which scenario+sprint this id belongs to.
  for (const s of SCENARIOS) {
    const totalDays =
      s.project.timelineStartDaysAgo + s.project.timelineDueDaysFromNow;
    const numSprints = Math.max(1, Math.ceil(totalDays / SPRINT_DAYS));
    for (let i = 0; i < numSprints; i++) {
      if (hashKey(`${s.project.jiraKey}-${i + 1}`, 1_000_000) === sprintId) {
        return synthIssuesForSprint(s, i + 1);
      }
    }
  }
  return { issues: [] };
}

type Scenario = (typeof SCENARIOS)[number];

function synthIssuesForSprint(
  s: Scenario,
  sprintNum: number,
): JiraSprintIssuesResponse {
  const totalDays =
    s.project.timelineStartDaysAgo + s.project.timelineDueDaysFromNow;
  const numSprints = Math.max(1, Math.ceil(totalDays / SPRINT_DAYS));
  const baseCommitted = Math.floor(s.project.committedPoints / numSprints);
  const remainder = s.project.committedPoints - baseCommitted * numSprints;
  const committed = baseCommitted + (sprintNum === numSprints ? remainder : 0);

  const today = seedHelpers.TODAY;
  const startDate = new Date(seedHelpers.daysAgo(s.project.timelineStartDaysAgo));
  const sprintStartTs =
    startDate.getTime() + (sprintNum - 1) * SPRINT_DAYS * 86_400_000;
  const sprintEndTs = sprintStartTs + SPRINT_DAYS * 86_400_000;
  const isPast = sprintEndTs <= today.getTime();
  const isCurrent =
    !isPast && sprintStartTs <= today.getTime() && today.getTime() < sprintEndTs;
  let completion = 0;
  if (isPast) completion = s.project.completionRate;
  else if (isCurrent) {
    const elapsedInSprint = (today.getTime() - sprintStartTs) / 86_400_000;
    completion = (elapsedInSprint / SPRINT_DAYS) * s.project.completionRate;
  }
  const completed = Math.round(committed * completion);

  const tasksPlanned = Math.max(1, Math.round(committed / POINTS_PER_TASK));
  const tasksCompleted = Math.round(completed / POINTS_PER_TASK);

  const issues: JiraIssueApi[] = [];
  const ptsPerTask = committed / tasksPlanned;
  const remainingHours =
    (s.project.budgetedHours / numSprints) *
    (sprintNum === numSprints ? numSprints - (numSprints - 1) : 1);
  const burnedHoursInSprint =
    isPast || isCurrent
      ? (s.project.budgetedHours / numSprints) *
        (isPast ? 1 : (today.getTime() - sprintStartTs) / 86_400_000 / SPRINT_DAYS) *
        s.project.burnRate
      : 0;
  const hoursPerTask = burnedHoursInSprint / Math.max(tasksPlanned, 1);

  for (let i = 0; i < tasksPlanned; i++) {
    const isDone = i < tasksCompleted;
    issues.push({
      id: `${hashKey(s.project.jiraKey + sprintNum + i, 100000)}`,
      key: `${s.project.jiraKey}-${sprintNum * 10 + i + 1}`,
      fields: {
        status: {
          name: isDone ? "Done" : i < tasksCompleted + 1 && isCurrent ? "In Progress" : "To Do",
          statusCategory: { key: isDone ? "done" : "indeterminate" },
        },
        timespent: Math.round(hoursPerTask * 3600),
        [STORY_POINTS_FIELD_ID]: Math.round(ptsPerTask),
      },
    });
  }
  void remainingHours; // currently not used for in-sprint allocation
  return { issues };
}

function synthAllProjectIssues(jiraKey: string): JiraSearchResponse {
  const s = SCENARIOS.find((x) => x.project.jiraKey === jiraKey);
  if (!s) return { issues: [] };
  const totalDays =
    s.project.timelineStartDaysAgo + s.project.timelineDueDaysFromNow;
  const numSprints = Math.max(1, Math.ceil(totalDays / SPRINT_DAYS));
  const issues: JiraIssueApi[] = [];
  for (let i = 1; i <= numSprints; i++) {
    issues.push(...synthIssuesForSprint(s, i).issues);
  }
  return { issues };
}

/* ============================================================================
 * Real adapter — same code path for mock-api and real
 * ========================================================================= */

let cachedSpFieldIds: string[] | null = null;
async function discoverStoryPointsFields(): Promise<string[]> {
  if (cachedSpFieldIds) return cachedSpFieldIds;
  const fields = await fetchOrSynth<JiraField[]>(
    "/rest/api/3/field",
    () => synthFields(),
  );
  // Workspaces often have BOTH the new "Story point estimate" (customfield_10016)
  // and a legacy "Story Points" (customfield_10038). Pick all matches and read
  // whichever holds a value per issue.
  const sp = fields.filter(
    (f) => f.custom && /story\s*points?/i.test(f.name),
  );
  if (sp.length === 0)
    throw new Error("Story Points custom field not found in Jira");
  cachedSpFieldIds = sp.map((f) => f.id);
  return cachedSpFieldIds;
}

async function getProjectBoardId(jiraKey: string): Promise<number> {
  const r = await fetchOrSynth<JiraBoardListResponse>(
    `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(jiraKey)}`,
    () => synthBoardForProject(jiraKey),
  );
  if (!r.values.length) throw new Error(`No board for project ${jiraKey}`);
  return r.values[0].id;
}

async function getSprints(boardId: number, jiraKey: string): Promise<JiraSprintApi[]> {
  const PAGE = 50;
  const all: JiraSprintApi[] = [];
  let startAt = 0;
  for (let i = 0; i < 20; i++) {
    // Jira /sprint does not accept state=*; omitting the filter returns all states.
    const r = await fetchOrSynth<JiraSprintListResponse>(
      `/rest/agile/1.0/board/${boardId}/sprint?maxResults=${PAGE}&startAt=${startAt}`,
      () => (i === 0 ? synthSprintsForProject(jiraKey) : { values: [], isLast: true }),
    );
    all.push(...r.values);
    if (r.isLast || r.values.length < PAGE) break;
    startAt += r.values.length;
  }
  return all;
}

async function getSprintIssues(
  sprintId: number,
  spFields: string[],
): Promise<JiraIssueApi[]> {
  const PAGE = 100;
  const all: JiraIssueApi[] = [];
  let startAt = 0;
  const fieldList = `status,${spFields.join(",")}`;
  for (let i = 0; i < 20; i++) {
    const r = await fetchOrSynth<JiraSprintIssuesResponse>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?fields=${fieldList}&maxResults=${PAGE}&startAt=${startAt}`,
      () => (i === 0 ? synthSprintIssues(sprintId) : { issues: [] }),
    );
    all.push(...r.issues);
    if (r.issues.length < PAGE) break;
    startAt += r.issues.length;
  }
  return all;
}

async function getProjectIssues(
  jiraKey: string,
  spFields: string[],
): Promise<JiraIssueApi[]> {
  const jql = encodeURIComponent(`project=${jiraKey}`);
  const fields = `status,timespent,${spFields.join(",")}`;
  const PAGE = 100;
  const all: JiraIssueApi[] = [];
  // Atlassian migrated /rest/api/3/search to /rest/api/3/search/jql with
  // token-based pagination (nextPageToken). The old endpoint returns 410.
  let nextPageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const params = new URLSearchParams({
      jql: decodeURIComponent(jql),
      fields,
      maxResults: String(PAGE),
    });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const path = `/rest/api/3/search/jql?${params.toString()}`;
    const r = await fetchOrSynth<JiraSearchResponse>(
      path,
      () => (i === 0 ? synthAllProjectIssues(jiraKey) : { issues: [] }),
    );
    all.push(...r.issues);
    if (!r.nextPageToken) break;
    nextPageToken = r.nextPageToken;
  }
  return all;
}

/* ============================================================================
 * Compose: the function the rest of the app calls
 * ========================================================================= */

function mapSprintState(state: JiraSprintApi["state"]): SprintStatus {
  return state === "closed"
    ? "completed"
    : state === "active"
      ? "current"
      : "upcoming";
}

function pointsOf(issue: JiraIssueApi, spFields: string[]): number {
  for (const fid of spFields) {
    const v = issue.fields[fid];
    if (typeof v === "number") return v;
  }
  return 0;
}

function isDone(issue: JiraIssueApi): boolean {
  return issue.fields.status.statusCategory.key === "done";
}

export async function composeJiraProject(
  jiraProjectKey: string,
  budgetedHours: number,
): Promise<JiraProjectShape> {
  const spFields = await discoverStoryPointsFields();
  const boardId = await getProjectBoardId(jiraProjectKey);
  const sprints = await getSprints(boardId, jiraProjectKey);
  const allIssues = await getProjectIssues(jiraProjectKey, spFields);

  // Aggregate project-level numbers
  const committedPoints = allIssues.reduce((a, i) => a + pointsOf(i, spFields), 0);
  const donePoints = allIssues
    .filter(isDone)
    .reduce((a, i) => a + pointsOf(i, spFields), 0);
  const loggedSeconds = allIssues.reduce(
    (a, i) => a + (typeof i.fields.timespent === "number" ? i.fields.timespent : 0),
    0,
  );
  const loggedHours = Math.round(loggedSeconds / 3600);

  // Timeline = earliest sprint start to latest sprint end
  const sortedByStart = [...sprints].sort((a, b) =>
    String(a.startDate ?? "").localeCompare(String(b.startDate ?? "")),
  );
  const startISO =
    sortedByStart[0]?.startDate ?? new Date().toISOString();
  const endISO =
    [...sprints]
      .sort((a, b) => String(b.endDate ?? "").localeCompare(String(a.endDate ?? "")))[0]
      ?.endDate ?? new Date().toISOString();
  const startDate = new Date(startISO);
  const dueDate = new Date(endISO);
  const today = new Date();
  const totalDays = (dueDate.getTime() - startDate.getTime()) / 86_400_000;
  const elapsed = (today.getTime() - startDate.getTime()) / 86_400_000;
  const elapsedFrac = totalDays > 0 ? elapsed / totalDays : 0;

  // Per-sprint breakdown — re-fetch issues per sprint so we get task counts.
  const builtSprints: JiraSprintShape[] = [];
  for (const sp of sprints) {
    const sIssues = await getSprintIssues(sp.id, spFields);
    const sprintCommitted = sIssues.reduce(
      (a, i) => a + pointsOf(i, spFields),
      0,
    );
    const sprintCompleted = sIssues
      .filter(isDone)
      .reduce((a, i) => a + pointsOf(i, spFields), 0);
    builtSprints.push({
      name: sp.name,
      number: builtSprints.length + 1,
      start: sp.startDate ?? startISO,
      end: sp.endDate ?? endISO,
      status: mapSprintState(sp.state),
      committedPoints: sprintCommitted,
      completedPoints: sprintCompleted,
      tasksPlanned: sIssues.length,
      tasksCompleted: sIssues.filter(isDone).length,
    });
  }
  const currentSprint =
    builtSprints.find((sp) => sp.status === "current") ??
    builtSprints[builtSprints.length - 1];

  // Burn series — linear projection (cannot get real per-day history without Tempo)
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
  if (todayInsideRange && !rawPoints.some((p) => p.day === todayLabel)) {
    const insertIdx = rawPoints.findIndex((p) => p.fracElapsed > elapsedFrac);
    rawPoints.splice(insertIdx >= 0 ? insertIdx : rawPoints.length, 0, {
      day: todayLabel,
      fracElapsed: elapsedFrac,
    });
  }
  // Real burnRate / completionRate are derived from current state
  const realBurnRate =
    elapsedFrac > 0 ? loggedHours / Math.max(budgetedHours, 1) / elapsedFrac : 1;
  const realCompletionRate =
    elapsedFrac > 0 ? donePoints / Math.max(committedPoints, 1) / elapsedFrac : 1;
  const burnSeries = rawPoints.map((p) => ({
    day: p.day,
    budgetPct: Math.round(Math.min(150, p.fracElapsed * realBurnRate * 100)),
    timelinePct: Math.round(p.fracElapsed * 100),
    outputPct: Math.round(Math.min(150, p.fracElapsed * realCompletionRate * 100)),
  }));

  return {
    key: jiraProjectKey,
    budgetedHours,
    loggedHours,
    committedPoints,
    donePoints,
    timeline: { start: startISO, due: endISO },
    burnSeries,
    todayLabel,
    sprints: builtSprints,
    currentSprint,
  };
}
