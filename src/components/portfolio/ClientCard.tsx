import Link from "next/link";
import { HealthBadge } from "./HealthBadge";
import { daysSince, fmtMoney } from "@/lib/format";
import type { Client, TimelineStatus } from "@/lib/types";

const timelineMeta: Record<
  TimelineStatus,
  { label: string; tone: string }
> = {
  early: { label: "Early", tone: "bg-slate-100 text-slate-600" },
  "on-track": {
    label: "On track",
    tone: "bg-emerald-100 text-emerald-700",
  },
  "at-risk": { label: "At risk", tone: "bg-amber-100 text-amber-700" },
  behind: { label: "Behind", tone: "bg-rose-100 text-rose-700" },
  overdue: { label: "Overdue", tone: "bg-rose-200 text-rose-800" },
};

export function ClientCard({ client }: { client: Client }) {
  const tl = timelineMeta[client.timelineStatus];
  const p = client.progress;
  const expectedPct = Math.min(
    100,
    (p.expected / Math.max(p.committed, 1)) * 100,
  );

  return (
    <Link
      href={`/portfolio/${client.id}`}
      className="group block rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition hover:ring-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold tracking-tight text-slate-900 group-hover:underline">
            {client.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {client.industry} · {client.deal.stage}
          </div>
        </div>
        <HealthBadge
          score={client.health.score}
          band={client.health.band}
          size="lg"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-500">{fmtMoney(client.deal.amount)}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tl.tone}`}
        >
          {tl.label}
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-[11px] text-slate-500">
          <span>Progress</span>
          <span className="tabular-nums">
            {p.delivered}/{p.committed} pts ({p.pct}%)
          </span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.min(100, p.pct)}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-700"
            style={{ left: `${expectedPct}%` }}
            title={`expected ${p.expected} pts`}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
            {client.risks.length} risk{client.risks.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
            {client.opportunities.length} opp
            {client.opportunities.length === 1 ? "" : "s"}
          </span>
        </div>
        {client.lastTouchpoint ? (
          <span title={client.lastTouchpoint.summary}>
            last contact: {daysSince(client.lastTouchpoint.date)}d ago
          </span>
        ) : (
          <span>no contact</span>
        )}
      </div>

    </Link>
  );
}
