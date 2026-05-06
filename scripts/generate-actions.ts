/**
 * Generate next-actions fixtures from a full client snapshot.
 * Idempotent per client (keyed by client id). Set FORCE=1 to rebuild.
 *
 * Run: pnpm tsx scripts/generate-actions.ts
 */
import "dotenv/config";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { openai } from "../src/lib/openai";
import { getPortfolio } from "../src/lib/data/getPortfolio";
import type { Client, NextAction } from "../src/lib/types";

const FIXTURE_PATH = resolve(
  process.cwd(),
  "src/mocks/fixtures/actions.json",
);
const FORCE = process.env.FORCE === "1";

const ActionSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  description: z.string().max(140),
  reason: z.string().max(200),
});
const ResponseSchema = z.object({
  actions: z.array(ActionSchema).min(1).max(4),
});

const SCHEMA_FOR_API = {
  type: "object" as const,
  additionalProperties: false,
  required: ["actions"],
  properties: {
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "description", "reason"],
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
          description: { type: "string", maxLength: 140 },
          reason: { type: "string", maxLength: 200 },
        },
      },
    },
  },
};

const SYSTEM = `You are a senior account director. Given a snapshot of a client engagement (deal, project burn, recent calls, sentiment, health flags), output 2–4 concrete next actions the account team should take.
Each action must be specific (a person could do it tomorrow), prioritized, and tied to a reason from the data. Avoid generic advice.`;

function summarize(c: Client): string {
  return JSON.stringify(
    {
      name: c.name,
      industry: c.industry,
      deal: { stage: c.deal.stage, amount: c.deal.amount },
      project: {
        budgetedHours: c.project.budgetedHours,
        loggedHours: c.project.loggedHours,
        committedPoints: c.project.committedPoints,
        donePoints: c.project.donePoints,
        timeline: c.project.timeline,
      },
      health: {
        score: c.health.score,
        band: c.health.band,
        flags: c.health.flags,
      },
      recentCalls: c.recentCalls.map((r) => ({
        date: r.date.slice(0, 10),
        sentiment: r.sentiment?.label,
        riskFlags: r.sentiment?.riskFlags,
        notes: r.notes,
      })),
      emailThreads: c.emailThreads.map((e) => ({
        date: e.date.slice(0, 10),
        subject: e.subject,
        snippet: e.snippet,
        sentiment: e.sentiment?.label,
      })),
    },
    null,
    2,
  );
}

async function suggest(c: Client): Promise<NextAction[]> {
  const r = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "next_actions",
        strict: true,
        schema: SCHEMA_FOR_API,
      },
    },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: summarize(c) },
    ],
  });
  const raw = r.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from OpenAI");
  return ResponseSchema.parse(JSON.parse(raw)).actions;
}

function loadFixture(): Record<string, NextAction[]> {
  if (!existsSync(FIXTURE_PATH)) return {};
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function saveFixture(f: Record<string, NextAction[]>) {
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(f, null, 2));
}

async function main() {
  const snap = await getPortfolio();
  const fx = FORCE ? {} : loadFixture();
  let count = 0;
  for (const c of snap.clients) {
    if (fx[c.id] && !FORCE) continue;
    console.log(`[actions] ${c.id} ...`);
    fx[c.id] = await suggest(c);
    count++;
  }
  saveFixture(fx);
  console.log(`\nDone. Generated actions for ${count} clients.`);
  console.log(`Fixture: ${FIXTURE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
