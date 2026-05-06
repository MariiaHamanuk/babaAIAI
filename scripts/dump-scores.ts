/**
 * Quick CLI for tuning health weights.
 * Run: pnpm tsx scripts/dump-scores.ts
 */
import "dotenv/config";

import { SCENARIOS } from "../src/mocks/seed";
import { getPortfolio } from "../src/lib/data/getPortfolio";

async function main() {
  const snap = await getPortfolio();
  const order = [...snap.clients].sort((a, b) => a.health.score - b.health.score);
  console.log("");
  console.log("Score order (low → high):");
  console.log("─".repeat(70));
  for (const c of order) {
    const flags = c.health.flags.length
      ? `   [${c.health.flags.join(", ")}]`
      : "";
    console.log(
      `  ${c.health.band.padEnd(7)} ${String(c.health.score).padStart(3)}  ${c.name}${flags}`,
    );
  }
  console.log("");
  console.log("Per-factor contributions:");
  console.log("─".repeat(70));
  const target = SCENARIOS.find((s) => s.id === "pinecone");
  if (target) {
    const c = snap.clients.find((x) => x.id === target.id);
    if (c) {
      console.log(`\n  ${c.name}:`);
      for (const f of c.health.factors) {
        console.log(
          `    ${f.name.padEnd(22)} value=${f.value.toFixed(2)}  weight=${f.weight.toFixed(2)}  → ${f.contribution.toFixed(1)}`,
        );
      }
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
