import { fmtDate } from "@/lib/format";
import type { Sprint } from "@/lib/types";

const statusMeta: Record<Sprint["status"], { label: string; tone: string }> = {
  completed: { label: "Done", tone: "bg-slate-100 text-slate-600" },
  current: { label: "Current", tone: "bg-sky-100 text-sky-700" },
  upcoming: { label: "Upcoming", tone: "bg-slate-50 text-slate-500" },
};

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

      <div className="overflow-hidden rounded-lg ring-1 ring-slate-200/70">
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
              const pct =
                s.committedPoints === 0
                  ? 0
                  : Math.round(
                      (s.completedPoints / s.committedPoints) * 100,
                    );
              const barColor =
                s.status === "upcoming"
                  ? "bg-slate-200"
                  : pct >= 90
                    ? "bg-emerald-500"
                    : pct >= 60
                      ? "bg-amber-500"
                      : pct > 0
                        ? "bg-rose-500"
                        : "bg-slate-200";
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
