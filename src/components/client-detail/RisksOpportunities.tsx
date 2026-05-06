import { fmtDate } from "@/lib/format";
import type { OpportunityItem, RiskItem } from "@/lib/types";

const sevTone: Record<RiskItem["severity"], string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

const sourceLabel: Record<RiskItem["source"], string> = {
  call: "Call",
  email: "Email",
  computed: "Signal",
};

export function RisksOpportunities({
  risks,
  opportunities,
}: {
  risks: RiskItem[];
  opportunities: OpportunityItem[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Risks</h3>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
            {risks.length}
          </span>
        </div>
        {risks.length === 0 ? (
          <p className="text-sm text-slate-500">No risks detected.</p>
        ) : (
          <ul className="space-y-2.5">
            {risks.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50/60 p-2.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider ${sevTone[r.severity]}`}
                  >
                    {r.severity}
                  </span>
                  <span className="text-slate-500">
                    {sourceLabel[r.source]} · {fmtDate(r.date)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {r.description}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Opportunities
          </h3>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {opportunities.length}
          </span>
        </div>
        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-500">
            No opportunities detected yet.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {opportunities.map((o) => (
              <li key={o.id} className="rounded-lg bg-emerald-50/40 p-2.5">
                <div className="text-[11px] text-slate-500">
                  {sourceLabel[o.source]} · {fmtDate(o.date)}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {o.description}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
