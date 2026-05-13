"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Project } from "@/lib/types";

type TooltipPayloadEntry = {
  dataKey?: string;
  value?: number | null;
  color?: string;
  name?: string;
};

function BurnTooltip({
  active,
  payload,
  label,
  todayLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  todayLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const isFuture = typeof label === "string" && label > todayLabel;
  const seen = new Set<string>();
  const rows = payload
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => {
      // Strip "Actual"/"Projected" duplication: prefer Actual unless we're past today.
      const baseName = (p.name ?? "").replace(/ \(projected\)$/, "");
      const isProjected = (p.name ?? "").includes("(projected)");
      // On past dates, only keep Actual; on future dates, only keep Projected.
      if (isFuture && !isProjected) return null;
      if (!isFuture && isProjected) return null;
      if (seen.has(baseName)) return null;
      seen.add(baseName);
      return { name: baseName, value: p.value as number, color: p.color };
    })
    .filter((r): r is { name: string; value: number; color: string } =>
      Boolean(r),
    )
    .sort((a, b) => b.value - a.value);

  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {label}
        {isFuture ? (
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              fontWeight: 500,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            projected
          </span>
        ) : null}
      </div>
      {rows.map((r) => (
        <div
          key={r.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: r.color,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: r.color,
            }}
          />
          <span>
            {r.name}: {r.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

type Row = {
  day: string;
  budgetPctActual: number | null;
  budgetPctProjected: number | null;
  timelinePctActual: number | null;
  timelinePctProjected: number | null;
  outputPctActual: number | null;
  outputPctProjected: number | null;
};

function splitSeries(project: Project): Row[] {
  const today = project.todayLabel;
  return project.burnSeries.map((p) => {
    // Today itself appears in both so the actual and projected lines connect.
    const isPast = p.day <= today;
    const isFuture = p.day >= today;
    return {
      day: p.day,
      budgetPctActual: isPast ? p.budgetPct : null,
      budgetPctProjected: isFuture ? p.budgetPct : null,
      timelinePctActual: isPast ? p.timelinePct : null,
      timelinePctProjected: isFuture ? p.timelinePct : null,
      outputPctActual: isPast ? p.outputPct : null,
      outputPctProjected: isFuture ? p.outputPct : null,
    };
  });
}

export function BurnChart({ project }: { project: Project }) {
  const data = splitSeries(project);
  const lastDay = project.burnSeries[project.burnSeries.length - 1]?.day;
  const showProjected =
    lastDay !== undefined && project.todayLabel < lastDay;

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Budget burn vs work delivered
          <span className="group relative inline-flex">
            <span
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
              aria-label="How to read this chart"
            >
              ?
            </span>
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-md bg-slate-900 p-3 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100"
            >
              <div className="mb-1.5 font-semibold">
                Each line = % of project total
              </div>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block size-2 shrink-0 rounded-full bg-rose-500" />
                  <span>
                    <strong>Budget used</strong> — hours / budgeted
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500" />
                  <span>
                    <strong>Delivered</strong> — story points done / committed
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block size-2 shrink-0 rounded-full bg-slate-400" />
                  <span>
                    <strong>Time</strong> — days elapsed / total
                  </span>
                </li>
              </ul>
              <div className="mt-2 border-t border-white/15 pt-2">
                <div className="font-semibold">How to read it</div>
                <ul className="mt-1 space-y-0.5">
                  <li>· Budget above Time → over-spending</li>
                  <li>· Delivered below Time → behind plan</li>
                </ul>
              </div>
            </span>
          </span>
        </h3>
        <span className="text-xs text-slate-500">cumulative %</span>
      </div>
      <div className="h-56 [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="budget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="timeline" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="output" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="day"
              fontSize={11}
              stroke="#94a3b8"
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis fontSize={11} stroke="#94a3b8" unit="%" />
            <Tooltip content={<BurnTooltip todayLabel={project.todayLabel} />} />

            {showProjected ? (
              <ReferenceArea
                x1={project.todayLabel}
                x2={lastDay}
                fill="#475569"
                fillOpacity={0.05}
                ifOverflow="visible"
              >
                <Label
                  value="Projected"
                  position="insideTopRight"
                  fill="#94a3b8"
                  fontSize={11}
                  offset={8}
                />
              </ReferenceArea>
            ) : null}

            {/* Actual (solid, filled) — render order = z-index. Delivered is on top. */}
            <Area
              type="monotone"
              dataKey="timelinePctActual"
              name="Time elapsed"
              stroke="#64748b"
              fill="url(#timeline)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 2.5, stroke: "#64748b", fill: "#fff", strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="budgetPctActual"
              name="Budget used"
              stroke="#ef4444"
              fill="url(#budget)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 2.5, stroke: "#ef4444", fill: "#fff", strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="outputPctActual"
              name="Delivered"
              stroke="#10b981"
              fill="none"
              strokeWidth={2.5}
              connectNulls
              dot={{ r: 3, stroke: "#10b981", fill: "#fff", strokeWidth: 2 }}
            />

            {/* Projected (dashed, no fill) */}
            <Area
              type="monotone"
              dataKey="timelinePctProjected"
              name="Timeline (projected)"
              stroke="#64748b"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              connectNulls
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="outputPctProjected"
              name="Output (projected)"
              stroke="#10b981"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              connectNulls
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="budgetPctProjected"
              name="Budget (projected)"
              stroke="#ef4444"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              connectNulls
              legendType="none"
            />

            {showProjected ? (
              <ReferenceLine
                x={project.todayLabel}
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              >
                <Label
                  value="Today"
                  position="top"
                  fill="#475569"
                  fontSize={11}
                />
              </ReferenceLine>
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-rose-500" />
          Budget used (hours)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-slate-500" />
          Time elapsed (days)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          Delivered (story points)
        </span>
        {showProjected ? (
          <span className="ml-auto flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-px w-6 border-t border-dashed border-slate-500" />
            projected (after Today)
          </span>
        ) : null}
      </div>
    </div>
  );
}
