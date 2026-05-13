import Link from "next/link";
import { HealthBadge } from "../portfolio/HealthBadge";
import { daysSince, fmtMoney } from "@/lib/format";
import type { Client } from "@/lib/types";

export function DealHeader({ client }: { client: Client }) {
  return (
    <header>
      <Link
        href="/portfolio"
        className="text-xs text-slate-500 hover:text-slate-700"
      >
        ← Portfolio
      </Link>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.name}
        </h1>
        <HealthBadge
          score={client.health.score}
          band={client.health.band}
          size="md"
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
        <span>{client.industry}</span>
        <span className="text-slate-300">·</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {client.deal.stage}
        </span>
        <span className="text-slate-300">·</span>
        <span className="font-medium text-slate-900">
          {fmtMoney(client.deal.amount)}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">
          owner: {client.deal.ownerEmail}
        </span>
      </div>
      {client.lastTouchpoint ? (
        <div className="mt-2 text-xs text-slate-500">
          Last touchpoint: {client.lastTouchpoint.type} ·{" "}
          {daysSince(client.lastTouchpoint.date)} days ago
        </div>
      ) : null}
    </header>
  );
}
