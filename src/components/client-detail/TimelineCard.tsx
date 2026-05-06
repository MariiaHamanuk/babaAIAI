import { fmtDate, daysSince } from "@/lib/format";
import type { Client } from "@/lib/types";

const statusMeta: Record<
  Client["timelineStatus"],
  { label: string; tone: string }
> = {
  early: {
    label: "Early",
    tone: "bg-slate-100 text-slate-700",
  },
  "on-track": {
    label: "On track",
    tone: "bg-emerald-100 text-emerald-700",
  },
  "at-risk": {
    label: "At risk",
    tone: "bg-amber-100 text-amber-700",
  },
  behind: {
    label: "Behind",
    tone: "bg-rose-100 text-rose-700",
  },
  overdue: {
    label: "Overdue",
    tone: "bg-rose-200 text-rose-800",
  },
};

export function TimelineCard({ client }: { client: Client }) {
  const meta = statusMeta[client.timelineStatus];
  const due = new Date(client.project.timeline.due);
  const start = new Date(client.project.timeline.start);
  const total = (due.getTime() - start.getTime()) / 86_400_000;
  const elapsed = (Date.now() - start.getTime()) / 86_400_000;
  const elapsedPct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  const daysLeft = Math.round(
    (due.getTime() - Date.now()) / 86_400_000,
  );
  const p = client.progress;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Timeline & progress
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Start
          </div>
          <div className="text-sm font-medium text-slate-800">
            {fmtDate(client.project.timeline.start)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Days left
          </div>
          <div
            className={`text-sm font-medium ${daysLeft < 0 ? "text-rose-700" : "text-slate-800"}`}
          >
            {daysLeft < 0 ? `${-daysLeft}d overdue` : `${daysLeft}d`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Due
          </div>
          <div className="text-sm font-medium text-slate-800">
            {fmtDate(client.project.timeline.due)}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
          <span>Time elapsed</span>
          <span>{elapsedPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-slate-400"
            style={{ width: `${elapsedPct}%` }}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-slate-500">Work delivered</span>
          <span className="text-slate-700">
            {p.delivered}/{p.committed} pts
            <span className="ml-1 text-slate-400">({p.pct}%)</span>
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.min(100, p.pct)}%` }}
          />
          {/* expected marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-700"
            style={{
              left: `${Math.min(100, (p.expected / Math.max(p.committed, 1)) * 100)}%`,
            }}
            title={`expected by now: ${p.expected} pts`}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>delivered</span>
          <span>
            <span className="mr-1 inline-block h-2 w-0.5 bg-slate-700 align-middle" />
            expected by now: {p.expected} pts
          </span>
        </div>
      </div>

      {client.lastTouchpoint ? (
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Last client touchpoint
          </div>
          <div className="mt-0.5 text-slate-700">
            {fmtDate(client.lastTouchpoint.date)} ·{" "}
            {client.lastTouchpoint.type}{" "}
            <span className="text-slate-400">
              ({daysSince(client.lastTouchpoint.date)}d ago)
            </span>
          </div>
          <div className="mt-0.5 text-slate-500">
            {client.lastTouchpoint.summary}
          </div>
        </div>
      ) : null}
    </div>
  );
}
