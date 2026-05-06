import { fmtMoney } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/types";

function Tile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "danger";
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-semibold tracking-tight ${accent === "danger" ? "text-rose-600" : "text-slate-900"}`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

export function KpiStrip({ snap }: { snap: PortfolioSnapshot }) {
  const { totals } = snap;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Tile label="Clients" value={String(totals.clients)} />
      <Tile
        label="At-Risk"
        value={String(totals.atRisk)}
        accent={totals.atRisk > 0 ? "danger" : undefined}
        hint={totals.atRisk === 0 ? "All green" : "yellow + red bands"}
      />
      <Tile label="Avg Health" value={String(totals.avgHealth)} />
      <Tile label="Pipeline" value={fmtMoney(totals.pipeline)} />
    </div>
  );
}
