/**
 * Print mathematical predictions per scenario.
 * Run: pnpm tsx scripts/dump-predictions.ts
 */
import "dotenv/config";

import { getPortfolio } from "../src/lib/data/getPortfolio";

async function main() {
  const snap = await getPortfolio();
  console.log("");
  console.log("Predictions per scenario:");
  console.log("─".repeat(90));
  for (const c of snap.clients) {
    const p = c.predictions;
    console.log(`\n  ${c.name} (${c.health.band} ${c.health.score})`);
    console.log(`    confidence: ${p.confidence}`);
    console.log(`    final budget: ${p.finalBudgetPct ?? "—"}%`);
    console.log(`    final delivery: ${p.finalDeliveryPct ?? "—"}%`);
    console.log(`    done by: ${p.predictedDoneDate?.slice(0, 10) ?? "—"}`);
    console.log(`    days vs due: ${p.daysVsDue ?? "—"}`);
    console.log(`    trending: ${p.trendingHealthBand ?? "—"}`);
    console.log(`    summary: ${p.summary}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
