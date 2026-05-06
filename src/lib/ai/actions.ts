import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { cache } from "../cache";
import { cacheDisabled } from "../env";
import { openai } from "../openai";
import type { Client, NextAction } from "../types";

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

// Build a deterministic input string per client (for hashing + the LLM call).
function snapshotInput(client: Omit<Client, "nextActions" | "predictions">) {
  return JSON.stringify(
    {
      name: client.name,
      industry: client.industry,
      deal: { stage: client.deal.stage, amount: client.deal.amount },
      project: {
        budgetedHours: client.project.budgetedHours,
        loggedHours: client.project.loggedHours,
        committedPoints: client.project.committedPoints,
        donePoints: client.project.donePoints,
        timeline: client.project.timeline,
      },
      health: {
        score: client.health.score,
        band: client.health.band,
        flags: client.health.flags,
      },
      timelineStatus: client.timelineStatus,
      recentCalls: client.recentCalls.map((r) => ({
        date: r.date.slice(0, 10),
        sentiment: r.sentiment?.label,
        riskFlags: r.sentiment?.riskFlags,
        notes: r.notes,
      })),
      emailThreads: client.emailThreads.map((e) => ({
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

const hashContent = (text: string) =>
  createHash("sha1").update(text).digest("hex").slice(0, 12);

// Warm-start fixture (existing v0.0 actions.json).
let legacyFixture: Record<string, NextAction[]> | null = null;
function loadLegacyFixture(): Record<string, NextAction[]> {
  if (legacyFixture) return legacyFixture;
  const path = resolve(process.cwd(), "src/mocks/fixtures/actions.json");
  if (!existsSync(path)) {
    legacyFixture = {};
    return legacyFixture;
  }
  legacyFixture = JSON.parse(readFileSync(path, "utf8"));
  return legacyFixture!;
}

async function generate(prompt: string): Promise<NextAction[]> {
  try {
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
        { role: "user", content: prompt },
      ],
    });
    const raw = r.choices[0]?.message?.content;
    if (!raw) return [];
    return ResponseSchema.parse(JSON.parse(raw)).actions;
  } catch (e) {
    console.error(`[actions] generation failed`, e);
    return [];
  }
}

export type ActionsEmit = (info: {
  clientId: string;
  clientName: string;
  done: number;
  total: number;
  fromCache: boolean;
}) => void;

const CONCURRENCY = 10;
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

/**
 * Returns Map<clientId, NextAction[]>. Cached forever per (clientId, snapshotHash).
 * Falls back to legacy fixture once if both cache + fixture-id miss.
 */
export async function suggestActionsBatch(
  clients: Array<Omit<Client, "nextActions" | "predictions">>,
  emit?: ActionsEmit,
): Promise<Map<string, NextAction[]>> {
  const out = new Map<string, NextAction[]>();
  let done = 0;
  const total = clients.length;

  await runWithLimit(clients, CONCURRENCY, async (client) => {
    const prompt = snapshotInput(client);
    const key = `actions:v2:${client.id}:${hashContent(prompt)}`;

    // When DISABLE_CACHE=1, skip cache + fixture warm-start so we always
    // hit OpenAI; otherwise read cache → fixture → generate, cache the result.
    let actions: NextAction[] | undefined = cacheDisabled
      ? undefined
      : await cache.get<NextAction[]>(key);
    let fromCache = true;

    if (!actions) {
      const fx = cacheDisabled ? {} : loadLegacyFixture();
      if (fx[client.id]) {
        actions = fx[client.id];
        await cache.set(key, actions, null);
      } else {
        actions = await generate(prompt);
        if (!cacheDisabled) await cache.set(key, actions, null);
        fromCache = false;
      }
    }

    out.set(client.id, actions);
    done++;
    emit?.({
      clientId: client.id,
      clientName: client.name,
      done,
      total,
      fromCache,
    });
  });

  return out;
}
