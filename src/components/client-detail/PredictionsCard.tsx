import type { Predictions } from "@/lib/types";

const bandTone: Record<NonNullable<Predictions["trendingHealthBand"]>, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
};

const confidenceTone: Record<Predictions["confidence"], string> = {
  high: "text-slate-700",
  medium: "text-slate-500",
  low: "text-slate-400",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "danger" | "good";
}) {
  const valueColor =
    accent === "danger"
      ? "text-rose-700"
      : accent === "good"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold ${valueColor}`}>
        {value}
      </div>
      {hint ? <div className="text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function PredictionsCard({ predictions }: { predictions: Predictions }) {
  const p = predictions;

  if (p.confidence === "low" || p.finalBudgetPct === null) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Forecast (current trend)
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            low confidence
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{p.summary}</p>
      </div>
    );
  }

  const budgetAccent: "danger" | "good" | undefined =
    p.finalBudgetPct > 110 ? "danger" : p.finalBudgetPct < 90 ? "good" : undefined;
  const deliveryAccent: "danger" | "good" | undefined =
    p.finalDeliveryPct !== null && p.finalDeliveryPct < 80
      ? "danger"
      : p.finalDeliveryPct !== null && p.finalDeliveryPct >= 100
        ? "good"
        : undefined;
  const scheduleAccent: "danger" | "good" | undefined =
    p.daysVsDue !== null && p.daysVsDue >= 7
      ? "danger"
      : p.daysVsDue !== null && p.daysVsDue <= -3
        ? "good"
        : undefined;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Forecast (current trend)
          <span className="group relative inline-flex">
            <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 hover:bg-slate-200">
              ?
            </span>
            <span className="pointer-events-none invisible absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-md bg-slate-900 p-3 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
              Mathematical extrapolation: assumes the current burn rate and
              delivery rate continue unchanged through to the project due
              date. No prediction model.
            </span>
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {p.trendingHealthBand ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${bandTone[p.trendingHealthBand]}`}
            >
              trending {p.trendingHealthBand}
            </span>
          ) : null}
          <span
            className={`text-[10px] font-medium uppercase tracking-wider ${confidenceTone[p.confidence]}`}
          >
            {p.confidence} confidence
          </span>
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-700">{p.summary}</p>

      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <Stat
          label="Final budget"
          value={`${p.finalBudgetPct}%`}
          hint={p.finalBudgetPct > 100 ? "over budget" : "within budget"}
          accent={budgetAccent}
        />
        <Stat
          label="Final delivery"
          value={p.finalDeliveryPct !== null ? `${p.finalDeliveryPct}%` : "—"}
          hint={
            p.finalDeliveryPct !== null && p.finalDeliveryPct < 100
              ? "of committed scope"
              : "of committed scope"
          }
          accent={deliveryAccent}
        />
        <Stat
          label="Done by"
          value={p.predictedDoneDate ? fmtDate(p.predictedDoneDate) : "—"}
          hint={
            p.daysVsDue === null
              ? undefined
              : p.daysVsDue <= -3
                ? `${Math.abs(p.daysVsDue)}d early`
                : p.daysVsDue >= 3
                  ? `${p.daysVsDue}d late`
                  : "on time"
          }
          accent={scheduleAccent}
        />
      </div>
    </div>
  );
}
