/**
 * Validate that HubSpot has the data the dashboard needs.
 * Hits real HubSpot via the access token in .env. No Jira required.
 *
 * Run:  pnpm tsx scripts/check-hubspot.ts
 *       pnpm tsx scripts/check-hubspot.ts --details    (also lists calls/emails)
 */
import "dotenv/config";

const TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const SHOW_DETAILS = process.argv.includes("--details");

if (!TOKEN) {
  console.error("\nHUBSPOT_ACCESS_TOKEN not set in .env\n");
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
} as const;

const BASE = "https://api.hubapi.com";

const DEAL_PROPS = [
  "amount",
  "dealstage",
  "createdate",
  "hs_lastmodifieddate",
  "notes_last_contacted",
  "hubspot_owner_id",
  "budget_hours",
  "jira_project_key",
  "dealname",
];

const ok = (s: string) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s: string) => `\x1b[31m✗\x1b[0m ${s}`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`HubSpot ${path}: ${r.status} ${body.slice(0, 300)}`);
  }
  return r.json() as Promise<T>;
}

type HsObject<P = Record<string, unknown>> = {
  id: string;
  properties: P;
  associations?: {
    companies?: { results: Array<{ id: string }> };
  };
};

type HsList<T> = { results: T[]; paging?: { next?: { after: string } } };

type HsAssocRef = { toObjectId?: string; id?: string };

type DealProps = Partial<Record<(typeof DEAL_PROPS)[number], string | null>>;
type CompanyProps = { name?: string; domain?: string; industry?: string };

async function main() {
  console.log("");
  console.log(bold("HubSpot data check"));
  console.log(dim("─".repeat(78)));

  // 1. Connectivity check via /crm/v3/properties/deals (also confirms scopes for custom props)
  process.stdout.write("Auth + scope check: ");
  try {
    const props = await get<HsList<{ name: string }>>(
      "/crm/v3/properties/deals?archived=false",
    );
    const names = new Set(props.results.map((p) => p.name));
    const checks = [
      { name: "budget_hours", custom: true },
      { name: "jira_project_key", custom: true },
    ];
    console.log(ok("connected"));
    for (const c of checks) {
      if (names.has(c.name))
        console.log("  " + ok(`custom property '${c.name}' exists`));
      else
        console.log(
          "  " +
            bad(
              `custom property '${c.name}' is MISSING — create it in HubSpot Settings → Properties → Deal properties`,
            ),
        );
    }
  } catch (e) {
    console.log(bad("FAILED"));
    console.error(`  ${(e as Error).message}\n`);
    console.error(
      "Likely causes: bad token, missing 'crm.schemas.deals.read' scope on the Private App.",
    );
    process.exit(1);
  }

  // 2. Pipeline stages — confirms dealstage values are mappable
  process.stdout.write("\nPipeline + stages:  ");
  try {
    type PipelinesResp = {
      results: Array<{
        id: string;
        label?: string;
        stages: Array<{ id: string; label: string }>;
      }>;
    };
    const r = await get<PipelinesResp>("/crm/v3/pipelines/deals");
    console.log(
      ok(
        `${r.results.length} pipeline${r.results.length === 1 ? "" : "s"}, ` +
          `${r.results.reduce((a, p) => a + p.stages.length, 0)} stages total`,
      ),
    );
    for (const p of r.results) {
      console.log(`  ${p.label ?? p.id}:`);
      for (const s of p.stages) {
        console.log(`    ${s.id.padEnd(28)} → ${s.label}`);
      }
    }
  } catch (e) {
    console.log(bad((e as Error).message));
  }

  // 3. List all deals + check the two custom props on each
  console.log("\n" + bold("Deals") + ":");
  console.log(dim("─".repeat(78)));

  const params = new URLSearchParams({
    limit: "100",
    associations: "companies",
    properties: DEAL_PROPS.join(","),
  });
  let after: string | undefined;
  const allDeals: HsObject<DealProps>[] = [];
  do {
    if (after) params.set("after", after);
    const page = await get<HsList<HsObject<DealProps>>>(
      `/crm/v3/objects/deals?${params.toString()}`,
    );
    allDeals.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);

  if (allDeals.length === 0) {
    console.log(bad("No deals found in this HubSpot account."));
    process.exit(2);
  }

  const issues: string[] = [];

  for (const d of allDeals) {
    const name = d.properties.dealname ?? `(unnamed deal ${d.id})`;
    const budget = d.properties.budget_hours;
    const jiraKey = d.properties.jira_project_key;
    const stage = d.properties.dealstage;
    const ownerId = d.properties.hubspot_owner_id;
    const companyId = d.associations?.companies?.results?.[0]?.id;

    console.log(`\n  ${bold(name)}  ${dim(`(deal id: ${d.id})`)}`);

    // budget_hours
    if (budget != null && budget !== "" && Number(budget) > 0) {
      console.log("    " + ok(`budget_hours: ${budget}`));
    } else {
      console.log("    " + bad("budget_hours: missing or 0"));
      issues.push(`Deal ${d.id} (${name}): set budget_hours`);
    }

    // jira_project_key
    if (jiraKey && jiraKey.trim().length > 0) {
      console.log("    " + ok(`jira_project_key: ${jiraKey}`));
    } else {
      console.log("    " + bad("jira_project_key: missing"));
      issues.push(`Deal ${d.id} (${name}): set jira_project_key`);
    }

    // stage
    if (stage) {
      console.log("    " + ok(`dealstage: ${stage}`));
    } else {
      console.log("    " + bad("dealstage: missing"));
    }

    // owner
    if (ownerId) {
      try {
        const owner = await get<{ email?: string; firstName?: string }>(
          `/crm/v3/owners/${ownerId}`,
        );
        console.log(
          "    " + ok(`owner: ${owner.email ?? owner.firstName ?? ownerId}`),
        );
      } catch {
        console.log(
          "    " +
            bad(`owner id set (${ownerId}) but /owners lookup failed`),
        );
      }
    } else {
      console.log("    " + bad("owner: not set"));
    }

    // company
    if (companyId) {
      try {
        const c = await get<HsObject<CompanyProps>>(
          `/crm/v3/objects/companies/${companyId}?properties=name,domain,industry`,
        );
        const cn = c.properties.name ?? "(no name)";
        const cd = c.properties.domain ?? dim("(no domain)");
        const ci = c.properties.industry ?? dim("(no industry)");
        console.log("    " + ok(`company: ${cn}  ·  ${cd}  ·  ${ci}`));
      } catch {
        console.log("    " + bad("company id set but lookup failed"));
      }
    } else {
      console.log("    " + bad("company: no associated company"));
      issues.push(`Deal ${d.id} (${name}): associate a company`);
    }

    // calls + emails counts
    try {
      const callsAssoc = await get<HsList<HsAssocRef>>(
        `/crm/v3/objects/deals/${d.id}/associations/calls`,
      );
      const emailsAssoc = await get<HsList<HsAssocRef>>(
        `/crm/v3/objects/deals/${d.id}/associations/emails`,
      );
      const cN = callsAssoc.results.length;
      const eN = emailsAssoc.results.length;
      const cFn = cN > 0 ? ok : bad;
      const eFn = eN > 0 ? ok : bad;
      console.log(
        "    " + cFn(`calls: ${cN}`) + "    " + eFn(`emails: ${eN}`),
      );
      if (cN === 0)
        issues.push(`Deal ${d.id} (${name}): no calls logged`);
      if (eN === 0)
        issues.push(`Deal ${d.id} (${name}): no emails logged`);

      if (SHOW_DETAILS && (cN > 0 || eN > 0)) {
        // Pull the actual bodies for inspection
        if (cN > 0) {
          const ids = callsAssoc.results
            .map((x) => x.toObjectId ?? x.id)
            .filter((x): x is string => Boolean(x));
          const r = await fetch(
            `${BASE}/crm/v3/objects/calls/batch/read`,
            {
              method: "POST",
              headers: HEADERS,
              body: JSON.stringify({
                properties: ["hs_timestamp", "hs_call_body", "hs_call_duration"],
                inputs: ids.map((id) => ({ id })),
              }),
            },
          );
          if (r.ok) {
            type CallProps = {
              hs_timestamp?: string;
              hs_call_body?: string;
              hs_call_duration?: string;
            };
            const j = (await r.json()) as { results: HsObject<CallProps>[] };
            for (const c of j.results) {
              const body = (c.properties.hs_call_body ?? "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();
              const date = (c.properties.hs_timestamp ?? "").slice(0, 10);
              const dur = c.properties.hs_call_duration
                ? Math.round(Number(c.properties.hs_call_duration) / 60_000)
                : 0;
              console.log(
                dim(
                  `      📞 ${date} · ${dur}min · ${
                    body.length > 80 ? body.slice(0, 80) + "…" : body || "(empty body)"
                  }`,
                ),
              );
            }
          }
        }
        if (eN > 0) {
          const ids = emailsAssoc.results
            .map((x) => x.toObjectId ?? x.id)
            .filter((x): x is string => Boolean(x));
          const r = await fetch(
            `${BASE}/crm/v3/objects/emails/batch/read`,
            {
              method: "POST",
              headers: HEADERS,
              body: JSON.stringify({
                properties: ["hs_timestamp", "hs_email_subject", "hs_email_text"],
                inputs: ids.map((id) => ({ id })),
              }),
            },
          );
          if (r.ok) {
            type EmailProps = {
              hs_timestamp?: string;
              hs_email_subject?: string;
              hs_email_text?: string;
            };
            const j = (await r.json()) as { results: HsObject<EmailProps>[] };
            for (const e of j.results) {
              const subj = e.properties.hs_email_subject ?? "(no subject)";
              const text = (e.properties.hs_email_text ?? "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();
              const date = (e.properties.hs_timestamp ?? "").slice(0, 10);
              console.log(
                dim(
                  `      ✉  ${date} · ${subj} — ${
                    text.length > 60 ? text.slice(0, 60) + "…" : text || "(empty)"
                  }`,
                ),
              );
            }
          }
        }
      }
    } catch (e) {
      console.log("    " + bad(`engagement lookup failed: ${(e as Error).message}`));
    }
  }

  console.log("\n" + dim("─".repeat(78)));
  console.log(bold("Summary"));
  console.log(`  Deals total:           ${allDeals.length}`);
  console.log(
    `  Missing budget_hours:  ${
      allDeals.filter(
        (d) => !d.properties.budget_hours || Number(d.properties.budget_hours) <= 0,
      ).length
    }`,
  );
  console.log(
    `  Missing jira key:      ${
      allDeals.filter((d) => !d.properties.jira_project_key).length
    }`,
  );

  if (issues.length === 0) {
    console.log("\n" + ok("HubSpot side is fully populated. ✨"));
    console.log(dim("(Jira-side validation pending until that account is set up.)"));
  } else {
    console.log("\n" + bad(`${issues.length} issue${issues.length === 1 ? "" : "s"} to fix:`));
    for (const m of issues) console.log(`  · ${m}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("\n" + bad((e as Error).message) + "\n");
  process.exit(1);
});
