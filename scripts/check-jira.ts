/**
 * Validate that Jira has the data the dashboard needs, project by project.
 * Cross-references the project keys from HubSpot deals (`jira_project_key`).
 *
 * Run:  pnpm tsx scripts/check-jira.ts
 *       pnpm tsx scripts/check-jira.ts --details   (lists each issue's points + time spent)
 */
import "dotenv/config";

const BASE = process.env.JIRA_BASE_URL;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const SHOW_DETAILS = process.argv.includes("--details");

if (!BASE || !EMAIL || !TOKEN) {
  console.error(
    "\nMissing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN in .env\n",
  );
  process.exit(1);
}

const HEADERS = {
  Authorization:
    "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64"),
  Accept: "application/json",
} as const;

const ok = (s: string) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s: string) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s: string) => `\x1b[33m⚠\x1b[0m ${s}`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function jira<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!r.ok) {
    throw new Error(`Jira ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

async function jiraOptional<T>(
  path: string,
  errors?: string[],
): Promise<T | null> {
  try {
    return await jira<T>(path);
  } catch (e) {
    errors?.push(`${path} → ${(e as Error).message}`);
    return null;
  }
}

type JiraProject = { key: string; name: string };
type JiraField = { id: string; name: string; custom: boolean };
type JiraBoard = { id: number; name: string };
type JiraBoardList = { values: JiraBoard[] };
type JiraSprint = {
  id: number;
  name: string;
  state: "closed" | "active" | "future";
  startDate?: string;
  endDate?: string;
};
type JiraSprintList = { values: JiraSprint[]; isLast: boolean };
type JiraIssue = {
  key: string;
  fields: {
    status: { name: string; statusCategory: { key: string } };
    timespent?: number | null;
    [k: string]: unknown;
  };
};
type JiraSearch = { issues: JiraIssue[]; total: number };

async function expectedKeys(): Promise<string[]> {
  if (!HS_TOKEN) {
    console.log(
      warn(
        "HUBSPOT_ACCESS_TOKEN not set — falling back to default keys (NW/PC/AF/HB/OS).",
      ),
    );
    return ["NW", "PC", "AF", "HB", "OS"];
  }
  try {
    const r = await fetch(
      "https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=jira_project_key,dealname",
      { headers: { Authorization: `Bearer ${HS_TOKEN}` } },
    );
    if (!r.ok) throw new Error(`HubSpot ${r.status}`);
    const j = (await r.json()) as {
      results: Array<{
        properties: { jira_project_key?: string; dealname?: string };
      }>;
    };
    const keys = j.results
      .map((d) => d.properties.jira_project_key)
      .filter((k): k is string => Boolean(k));
    return Array.from(new Set(keys));
  } catch (e) {
    console.log(
      warn(
        `Could not fetch keys from HubSpot (${(e as Error).message}); using defaults.`,
      ),
    );
    return ["NW", "PC", "AF", "HB", "OS"];
  }
}

async function discoverStoryPointsFields(): Promise<JiraField[]> {
  const fields = await jiraOptional<JiraField[]>("/rest/api/3/field");
  if (!fields) return [];
  return fields.filter((f) => f.custom && /story\s*points?/i.test(f.name));
}

function pointsOf(issue: JiraIssue, spFields: string[]): number {
  for (const fid of spFields) {
    const v = issue.fields[fid];
    if (typeof v === "number") return v;
  }
  return 0;
}

function isDone(issue: JiraIssue): boolean {
  return issue.fields.status.statusCategory.key === "done";
}

async function main() {
  console.log("");
  console.log(bold("Jira data check"));
  console.log(dim("─".repeat(78)));
  console.log(dim(`Base: ${BASE}`));
  console.log(dim(`User: ${EMAIL}`));

  // 1. Auth
  process.stdout.write("\nAuth check:           ");
  const me = await jiraOptional<{ emailAddress?: string; displayName?: string }>(
    "/rest/api/3/myself",
  );
  if (!me) {
    console.log(bad("FAILED — bad token / email / base URL"));
    process.exit(1);
  }
  console.log(ok(`logged in as ${me.displayName ?? me.emailAddress}`));

  // 2. Story Points field(s) — workspaces often have multiple
  process.stdout.write("Story Points field(s):");
  const spFieldDefs = await discoverStoryPointsFields();
  if (spFieldDefs.length === 0) {
    console.log(
      " " + bad("not found — Jira workspace has no custom field matching 'Story Points'"),
    );
    process.exit(2);
  }
  const spFields = spFieldDefs.map((f) => f.id);
  console.log(
    " " + ok(spFieldDefs.map((f) => `${f.id} (${f.name})`).join(", ")),
  );

  // 3. Pull all projects so we can flag unknowns and missing
  const allProjects = await jiraOptional<JiraProject[]>(
    "/rest/api/3/project?expand=description",
  );
  if (allProjects) {
    console.log(
      "\n" +
        dim(
          `Workspace has ${allProjects.length} project${
            allProjects.length === 1 ? "" : "s"
          }: ${allProjects.map((p) => p.key).join(", ") || "(none)"}`,
        ),
    );
  }

  const wanted = await expectedKeys();
  console.log(
    dim(`Expected (from HubSpot): ${wanted.join(", ") || "(none)"}\n`),
  );

  console.log(bold("Per-project status"));
  console.log(dim("─".repeat(78)));

  const issues: string[] = [];

  for (const key of wanted) {
    console.log(`\n  ${bold(key)}`);

    // Project exists?
    const project = await jiraOptional<JiraProject & { description?: string }>(
      `/rest/api/3/project/${encodeURIComponent(key)}`,
    );
    if (!project) {
      console.log("    " + bad(`project '${key}' does NOT exist in Jira`));
      issues.push(`Create Jira project '${key}'`);
      continue;
    }
    console.log("    " + ok(`project: ${project.name}`));

    // Board
    const boards = await jiraOptional<JiraBoardList>(
      `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(key)}`,
    );
    if (!boards || boards.values.length === 0) {
      console.log(
        "    " +
          bad(
            "no board — project must use a Scrum board for sprint data",
          ),
      );
      issues.push(`${key}: project has no board (needs a Scrum board)`);
      continue;
    }
    const board = boards.values[0];
    console.log("    " + ok(`board: ${board.name} (id ${board.id})`));

    // Sprints — Jira's API doesn't accept state=*; omit the filter to get all
    const errs: string[] = [];
    const sprintList = await jiraOptional<JiraSprintList>(
      `/rest/agile/1.0/board/${board.id}/sprint?maxResults=50`,
      errs,
    );
    if (!sprintList) {
      console.log("    " + bad("could not fetch sprints"));
      for (const m of errs) console.log("      " + dim(m));
      continue;
    }
    const sprints = sprintList.values;
    const closed = sprints.filter((s) => s.state === "closed").length;
    const active = sprints.filter((s) => s.state === "active").length;
    const future = sprints.filter((s) => s.state === "future").length;
    if (sprints.length === 0) {
      console.log("    " + bad("no sprints created"));
      issues.push(`${key}: create at least 3 sprints (mix of closed/active/future)`);
    } else {
      const sprintFn = sprints.length >= 3 ? ok : warn;
      console.log(
        "    " +
          sprintFn(
            `sprints: ${sprints.length} total — ${closed} closed · ${active} active · ${future} future`,
          ),
      );
      if (active === 0) {
        console.log("      " + warn("no active sprint — start one to see 'current' data"));
        issues.push(`${key}: start a sprint (so it's in 'active' state)`);
      }
      if (closed === 0) {
        console.log(
          "      " +
            warn("no closed sprint — past sprints must be completed to populate history"),
        );
      }
    }

    // Issues + story points + time
    // Atlassian replaced /rest/api/3/search with /rest/api/3/search/jql in 2024.
    const jql = encodeURIComponent(`project=${key}`);
    const errs2: string[] = [];
    const search = await jiraOptional<JiraSearch>(
      `/rest/api/3/search/jql?jql=${jql}&fields=status,timespent,${spFields.join(",")}&maxResults=100`,
      errs2,
    );
    if (!search) {
      console.log("    " + bad("could not fetch issues"));
      for (const m of errs2) console.log("      " + dim(m));
      continue;
    }
    // /search/jql doesn't return `total`; use the issues array length.
    const totalIssues = search.issues.length;
    if (totalIssues === 0) {
      console.log("    " + bad("no issues created"));
      issues.push(`${key}: create issues with story points + time tracking`);
      continue;
    }
    const committedPoints = search.issues.reduce(
      (a, i) => a + pointsOf(i, spFields),
      0,
    );
    const donePoints = search.issues
      .filter(isDone)
      .reduce((a, i) => a + pointsOf(i, spFields), 0);
    const loggedSecs = search.issues.reduce(
      (a, i) => a + (typeof i.fields.timespent === "number" ? i.fields.timespent : 0),
      0,
    );
    const loggedHours = Math.round(loggedSecs / 3600);
    const issuesWithoutPoints = search.issues.filter(
      (i) => pointsOf(i, spFields) === 0,
    ).length;
    const issuesWithoutTime = search.issues.filter(
      (i) => !i.fields.timespent || i.fields.timespent === 0,
    ).length;

    const issuesFn = totalIssues >= 5 ? ok : warn;
    console.log(
      "    " +
        issuesFn(
          `issues: ${totalIssues}  ·  points ${donePoints}/${committedPoints}  ·  ${loggedHours}h logged`,
        ),
    );

    if (issuesWithoutPoints > 0) {
      console.log(
        "      " +
          warn(
            `${issuesWithoutPoints}/${totalIssues} issue${
              issuesWithoutPoints === 1 ? "" : "s"
            } have no Story Points set`,
          ),
      );
      issues.push(`${key}: set Story Points on ${issuesWithoutPoints} issue(s)`);
    }
    if (issuesWithoutTime > 0 && issuesWithoutTime === totalIssues) {
      console.log(
        "      " +
          bad(
            "no Time Spent logged on any issue — enable time tracking and log hours on Done issues",
          ),
      );
      issues.push(
        `${key}: log Time Spent on completed issues (Project Settings → Time tracking must be on)`,
      );
    } else if (issuesWithoutTime > 0) {
      console.log(
        "      " +
          warn(
            `${issuesWithoutTime}/${totalIssues} issue${
              issuesWithoutTime === 1 ? "" : "s"
            } have no Time Spent logged`,
          ),
      );
    }

    if (SHOW_DETAILS) {
      for (const i of search.issues.slice(0, 20)) {
        const pts = pointsOf(i, spFields);
        const secs =
          typeof i.fields.timespent === "number" ? i.fields.timespent : 0;
        const hrs = (secs / 3600).toFixed(1);
        console.log(
          dim(
            `        ${i.key.padEnd(8)} ${(i.fields.status.name + ` (${i.fields.status.statusCategory.key})`).padEnd(28)}  pts=${pts}  ${hrs}h`,
          ),
        );
      }
      if (search.issues.length > 20)
        console.log(dim(`        … and ${search.issues.length - 20} more`));
    }
  }

  // Unknown projects (in Jira but not requested by HubSpot)
  if (allProjects) {
    const wantedSet = new Set(wanted);
    const extras = allProjects.filter((p) => !wantedSet.has(p.key));
    if (extras.length > 0) {
      console.log(
        "\n" +
          dim(
            `Other projects in workspace (not referenced by HubSpot): ${extras
              .map((p) => p.key)
              .join(", ")}`,
          ),
      );
    }
  }

  console.log("\n" + dim("─".repeat(78)));
  console.log(bold("Summary"));
  if (issues.length === 0) {
    console.log(
      "\n" + ok("Jira side looks fully populated for the demo. ✨"),
    );
  } else {
    console.log(
      "\n" +
        bad(
          `${issues.length} issue${
            issues.length === 1 ? "" : "s"
          } to fix:`,
        ),
    );
    for (const m of issues) console.log(`  · ${m}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("\n" + bad((e as Error).message) + "\n");
  process.exit(1);
});
