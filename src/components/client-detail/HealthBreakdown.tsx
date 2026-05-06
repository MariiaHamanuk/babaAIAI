import type { Client } from "@/lib/types";

const factorLabel: Record<string, string> = {
  budgetVsTimeline: "Budget vs timeline",
  promisedVsDelivered: "Promised vs delivered",
  callsSentiment: "Calls sentiment",
  emailSentiment: "Email sentiment",
  momentum: "Momentum",
  staleness: "Recency of contact",
};

export function HealthBreakdown({ client }: { client: Client }) {
  const sorted = [...client.health.factors].sort(
    (a, b) => a.contribution - b.contribution,
  );
  const max = Math.max(
    ...client.health.factors.map((f) => f.weight * 100),
    1,
  );

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Health breakdown
        </h3>
        <span className="text-xs text-slate-500">
          weighted contributions (0–{Math.round(max)})
        </span>
      </div>
      <ul className="space-y-2.5">
        {sorted.map((f) => {
          const maxContribution = f.weight * 100;
          const pct = (f.contribution / maxContribution) * 100;
          const color =
            f.value >= 0.75
              ? "bg-emerald-500"
              : f.value >= 0.5
                ? "bg-amber-500"
                : "bg-rose-500";
          return (
            <li key={f.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700">{factorLabel[f.name]}</span>
                <span className="font-mono text-slate-500">
                  {f.contribution.toFixed(1)} / {maxContribution.toFixed(0)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

    </div>
  );
}
