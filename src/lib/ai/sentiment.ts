import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { cache } from "../cache";
import { cacheDisabled } from "../env";
import { openai } from "../openai";
import type { Sentiment } from "../types";

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

const SYSTEM = `You analyze short business communications between an account team and a client.
For each input, return:
- score: -1 (very negative, frustrated, churn-risk) to +1 (very positive, expanding, advocating).
- label: one of very_negative, negative, neutral, positive, very_positive (must align with score).
- dominantEmotion: one of frustrated, concerned, neutral, satisfied, enthusiastic.
- riskFlags: any of delays, scope_creep, escalation, churn_risk, budget_pressure that the text explicitly suggests. Empty array if none.
- opportunitySignals: any of expansion (more scope/teams/regions), reference (willing to be a reference), case_study (willing to share their success publicly), renewal (intent to renew/extend), upsell (interest in additional products/services), advocacy (champion behavior, internal evangelism). Empty array if none.
- rationale: one sentence explaining your read.
Be precise. A polite tone with delay complaints is still "negative" and should flag delays. Don't infer opportunities from generic compliments — only flag when the text suggests a concrete future commitment or growth path.`;

const NEUTRAL_FALLBACK: Sentiment = {
  score: 0,
  label: "neutral",
  dominantEmotion: "neutral",
  riskFlags: [],
  opportunitySignals: [],
  rationale: "Unable to classify (LLM error or empty text).",
};

export type SentimentInput = {
  id: string;
  kind: "call" | "email";
  text: string;
};

const hashContent = (text: string) =>
  createHash("sha1").update(text).digest("hex").slice(0, 12);

const cacheKey = (input: SentimentInput) =>
  `sentiment:v2:${input.kind}:${input.id}:${hashContent(input.text)}`;

// Warm-start fixture (existing v0.0 sentiments.json) — content-addressed legacy.
type LegacyFixture = {
  calls: Record<string, Sentiment>;
  emails: Record<string, Sentiment>;
};
let legacyFixture: LegacyFixture | null = null;
function loadLegacyFixture(): LegacyFixture {
  if (legacyFixture) return legacyFixture;
  const path = resolve(process.cwd(), "src/mocks/fixtures/sentiments.json");
  if (!existsSync(path)) {
    legacyFixture = { calls: {}, emails: {} };
    return legacyFixture;
  }
  legacyFixture = JSON.parse(readFileSync(path, "utf8"));
  return legacyFixture!;
}

async function classify(input: SentimentInput): Promise<Sentiment> {
  if (!input.text || input.text.trim().length === 0) {
    return NEUTRAL_FALLBACK;
  }
  try {
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
        { role: "user", content: input.text },
      ],
    });
    const raw = r.choices[0]?.message?.content;
    if (!raw) return NEUTRAL_FALLBACK;
    return SentimentSchema.parse(JSON.parse(raw));
  } catch (e) {
    console.error(`[sentiment] ${input.kind}:${input.id} failed`, e);
    return NEUTRAL_FALLBACK;
  }
}

// Bounded concurrency: at most CONCURRENCY in-flight at once.
// gpt-4o-mini handles ~12+ parallel happily; sentiment calls are small (~700 tok).
const CONCURRENCY = 15;
async function runWithLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export type SentimentEmit = (info: {
  done: number;
  total: number;
  changedIds: string[];
}) => void;

/**
 * Classify a batch of items.
 * - Cache hit (same id + same content) → no OpenAI call.
 * - Cache miss → check legacy fixture for the id (warm-start).
 * - Still missing → call OpenAI and cache forever (TTL null).
 *
 * Returns a Map<id, Sentiment>.
 */
export async function classifyBatch(
  items: SentimentInput[],
  emit?: SentimentEmit,
): Promise<Map<string, Sentiment>> {
  const result = new Map<string, Sentiment>();
  const toClassify: SentimentInput[] = [];

  // First pass: cache + fixture warm-start (no OpenAI calls).
  // When DISABLE_CACHE=1, skip both the cache lookup and fixture warm-start
  // so every refresh re-runs LLM classification from scratch.
  for (const item of items) {
    if (cacheDisabled) {
      toClassify.push(item);
      continue;
    }
    const key = cacheKey(item);
    const cached = await cache.get<Sentiment>(key);
    if (cached) {
      result.set(item.id, cached);
      continue;
    }
    // Try legacy fixture by id (text hash not validated, so we trust it as a warm seed).
    const fx = loadLegacyFixture();
    const lookup = item.kind === "call" ? fx.calls : fx.emails;
    const hit = lookup[item.id];
    // Auto-invalidate fixture entries missing the new opportunitySignals field
    // so the schema upgrade triggers a fresh classification.
    if (hit && Array.isArray((hit as Sentiment).opportunitySignals)) {
      await cache.set(key, hit, null);
      result.set(item.id, hit);
      continue;
    }
    toClassify.push(item);
  }

  if (toClassify.length === 0) {
    emit?.({ done: items.length, total: items.length, changedIds: [] });
    return result;
  }

  let done = items.length - toClassify.length;
  emit?.({ done, total: items.length, changedIds: [] });
  const changedIds: string[] = [];

  await runWithLimit(toClassify, CONCURRENCY, async (item) => {
    const sentiment = await classify(item);
    if (!cacheDisabled) {
      await cache.set(cacheKey(item), sentiment, null);
    }
    result.set(item.id, sentiment);
    changedIds.push(item.id);
    done++;
    emit?.({ done, total: items.length, changedIds });
  });

  return result;
}
