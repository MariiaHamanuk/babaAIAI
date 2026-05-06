/**
 * Generate sentiment fixtures from seed data.
 * Idempotent: only calls OpenAI for ids not already in the fixture (unless FORCE=1).
 *
 * Run: pnpm tsx scripts/generate-sentiment.ts
 *      FORCE=1 pnpm tsx scripts/generate-sentiment.ts
 */
import "dotenv/config";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { openai } from "../src/lib/openai";
import { SCENARIOS, seedHelpers } from "../src/mocks/seed";
import type { Sentiment } from "../src/lib/types";

const FIXTURE_PATH = resolve(
  process.cwd(),
  "src/mocks/fixtures/sentiments.json",
);
const FORCE = process.env.FORCE === "1";

const SentimentSchema = z.object({
  score: z.number().min(-1).max(1),
  label: z.enum([
    "very_negative",
    "negative",
    "neutral",
    "positive",
    "very_positive",
  ]),
  dominantEmotion: z.enum([
    "frustrated",
    "concerned",
    "neutral",
    "satisfied",
    "enthusiastic",
  ]),
  riskFlags: z.array(
    z.enum([
      "delays",
      "scope_creep",
      "escalation",
      "churn_risk",
      "budget_pressure",
    ]),
  ),
  opportunitySignals: z.array(
    z.enum([
      "expansion",
      "reference",
      "case_study",
      "renewal",
      "upsell",
      "advocacy",
    ]),
  ),
  rationale: z.string().max(200),
});

type Fixture = {
  calls: Record<string, Sentiment>;
  emails: Record<string, Sentiment>;
};

function loadFixture(): Fixture {
  if (!existsSync(FIXTURE_PATH)) return { calls: {}, emails: {} };
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
}

function saveFixture(f: Fixture) {
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(f, null, 2));
}

const SYSTEM = `You analyze short business communications between an account team and a client.
For each input, return:
- score: -1 (very negative, frustrated, churn-risk) to +1 (very positive, expanding, advocating).
- label: one of very_negative, negative, neutral, positive, very_positive (must align with score).
- dominantEmotion: one of frustrated, concerned, neutral, satisfied, enthusiastic.
- riskFlags: any of delays, scope_creep, escalation, churn_risk, budget_pressure that the text explicitly suggests. Empty array if none.
- opportunitySignals: any of expansion (more scope/teams/regions), reference (willing to be a reference), case_study (willing to share their success publicly), renewal (intent to renew/extend), upsell (interest in additional products/services), advocacy (champion behavior, internal evangelism). Empty array if none.
- rationale: one sentence explaining your read.
Be precise. A polite tone with delay complaints is still "negative" and should flag delays. Don't infer opportunities from generic compliments — only flag when the text suggests a concrete future commitment or growth path.`;

const SCHEMA_FOR_API = {
  type: "object" as const,
  additionalProperties: false,
  required: [
    "score",
    "label",
    "dominantEmotion",
    "riskFlags",
    "opportunitySignals",
    "rationale",
  ],
  properties: {
    score: { type: "number", minimum: -1, maximum: 1 },
    label: {
      type: "string",
      enum: [
        "very_negative",
        "negative",
        "neutral",
        "positive",
        "very_positive",
      ],
    },
    dominantEmotion: {
      type: "string",
      enum: [
        "frustrated",
        "concerned",
        "neutral",
        "satisfied",
        "enthusiastic",
      ],
    },
    riskFlags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "delays",
          "scope_creep",
          "escalation",
          "churn_risk",
          "budget_pressure",
        ],
      },
    },
    opportunitySignals: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "expansion",
          "reference",
          "case_study",
          "renewal",
          "upsell",
          "advocacy",
        ],
      },
    },
    rationale: { type: "string", maxLength: 200 },
  },
};

async function classify(text: string): Promise<Sentiment> {
  const r = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sentiment",
        strict: true,
        schema: SCHEMA_FOR_API,
      },
    },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text },
    ],
  });
  const raw = r.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from OpenAI");
  return SentimentSchema.parse(JSON.parse(raw));
}

async function main() {
  const fx = FORCE ? { calls: {}, emails: {} } : loadFixture();

  let calls = 0;
  let emails = 0;

  for (const s of SCENARIOS) {
    for (let i = 0; i < s.calls.length; i++) {
      const id = `call-${s.id}-${i}`;
      if (fx.calls[id] && !FORCE) continue;
      const text = `Call between ${s.calls[i].participants.join(" and ")}, ${seedHelpers.daysAgo(s.calls[i].daysAgo).slice(0, 10)}:\n${s.calls[i].notes}`;
      console.log(`[call] ${id} ...`);
      fx.calls[id] = await classify(text);
      calls++;
    }
    for (let i = 0; i < s.emails.length; i++) {
      const id = `email-${s.id}-${i}`;
      if (fx.emails[id] && !FORCE) continue;
      const text = `Email subject: ${s.emails[i].subject}\nSnippet: ${s.emails[i].snippet}`;
      console.log(`[email] ${id} ...`);
      fx.emails[id] = await classify(text);
      emails++;
    }
  }

  saveFixture(fx);
  console.log(`\nDone. Generated ${calls} call + ${emails} email sentiments.`);
  console.log(`Fixture: ${FIXTURE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
