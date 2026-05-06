import type { NextAction } from "@/lib/types";

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

const priorityClass = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-700",
};

export function NextActions({ actions }: { actions: NextAction[] }) {
  const sorted = [...actions].sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">Next actions</h3>
        <p className="mt-2 text-sm text-slate-500">
          No actions suggested yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Next actions</h3>
      <ol className="space-y-3">
        {sorted.map((a, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex w-16 shrink-0 justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wider ${priorityClass[a.priority]}`}
            >
              {a.priority}
            </span>
            <div>
              <div className="text-sm font-medium text-slate-800">
                {a.description}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{a.reason}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
