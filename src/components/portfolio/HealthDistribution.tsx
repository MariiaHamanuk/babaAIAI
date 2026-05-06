"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { bandHex } from "@/lib/format";
import type { Client } from "@/lib/types";

export function HealthDistribution({ clients }: { clients: Client[] }) {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const c of clients) counts[c.health.band] += 1;
  const data = [
    { name: "Healthy", value: counts.green, band: "green" as const },
    { name: "Watch", value: counts.yellow, band: "yellow" as const },
    { name: "At-Risk", value: counts.red, band: "red" as const },
  ];

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="mb-2 text-sm font-medium text-slate-700">
        Health distribution
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={bandHex(d.band)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-around text-xs text-slate-600">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: bandHex(d.band) }}
            />
            <span>
              {d.name} <span className="text-slate-400">({d.value})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
