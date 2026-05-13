import { fmtDate } from "@/lib/format";
import type { Sprint } from "@/lib/types";

const statusMeta: Record<Sprint["status"], { label: string; tone: string }> = {
  completed: { label: "Done", tone: "bg-slate-100 text-slate-600" },
  current: { label: "Current", tone: "bg-sky-100 text-sky-700" },
  upcoming: { label: "Upcoming", tone: "bg-slate-50 text-slate-500" },
};

function pctOf(s: Sprint): number {
  if (s.committedPoints === 0) return 0;
  return Math.round((s.completedPoints / s.committedPoints) * 100);
}

function barColorOf(s: Sprint, pct: number): string {
  if (s.status === "upcoming") return "bg-slate-200";
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  if (pct > 0) return "bg-rose-500";
  return "bg-slate-200";
}

export function SprintBreakdown({ sprints }: { sprints: Sprint[] }) {
  if (sprints.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">Sprints</h3>
        <p className="mt-2 text-sm text-slate-500">No sprint data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Sprint breakdown
        </h3>
        <span className="text-xs text-slate-500">
          {sprints.length} sprint{sprints.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Mobile: card stack */}
      <ul className="space-y-2 sm:hidden">
        {sprints.map((s) => {
          const meta = statusMeta[s.status];
          const pct = pctOf(s);
          const barColor = barColorOf(s, pct);
          return (
            <li
              key={s.number}
              className={`rounded-lg p-3 ring-1 ring-slate-200/70 ${
                s.status === "current" ? "bg-sky-50/60" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    #{s.number}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {fmtDate(s.start)} – {fmtDate(s.end)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>
                  <span className="text-slate-400">Tasks</span>{" "}
                  <span className="font-mono">
                    {s.tasksCompleted}/{s.tasksPlanned}
                  </span>
                </span>
                <span>
                  <span className="text-slate-400">Points</span>{" "}
                  <span className="font-mono">
                    {s.completedPoints}/{s.committedPoints}
                  </span>
                </span>
                <span className="tabular-nums text-slate-500">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg ring-1 ring-slate-200/70 sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Sprint</th>
              <th className="px-3 py-2 text-left font-medium">Window</th>
              <th className="px-3 py-2 text-right font-medium">Tasks</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="px-3 py-2 text-left font-medium">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sprints.map((s) => {
              const meta = statusMeta[s.status];
              const pct = pctOf(s);
              const barColor = barColorOf(s, pct);
              return (
                <tr
                  key={s.number}
                  className={s.status === "current" ? "bg-sky-50/60" : ""}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">
                        #{s.number}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {fmtDate(s.start)} – {fmtDate(s.end)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">
                    {s.tasksCompleted}/{s.tasksPlanned}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">
                    {s.completedPoints}/{s.committedPoints}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-slate-500">
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
