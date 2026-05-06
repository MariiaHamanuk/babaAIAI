import Link from "next/link";
import { bandColor, bandHex } from "@/lib/format";
import type { Client } from "@/lib/types";

export function AtRiskList({ clients }: { clients: Client[] }) {
  const top = [...clients].sort((a, b) => a.health.score - b.health.score).slice(0, 5);

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-3 text-sm font-medium text-slate-700">
        Top at-risk
      </div>
      <ul className="space-y-2">
        {top.map((c) => {
          const pct = Math.max(8, c.health.score);
          return (
            <li key={c.id}>
              <Link
                href={`/portfolio/${c.id}`}
                className="block rounded-lg p-2 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {c.name}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${bandColor(c.health.band)}`}
                  >
                    {c.health.score}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: bandHex(c.health.band),
                    }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
