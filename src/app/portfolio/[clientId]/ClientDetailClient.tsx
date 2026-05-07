"use client";

import Link from "next/link";
import useSWR from "swr";
import { DealHeader } from "@/components/client-detail/DealHeader";
import { HealthBreakdown } from "@/components/client-detail/HealthBreakdown";
import { TimelineCard } from "@/components/client-detail/TimelineCard";
import { BurnChart } from "@/components/client-detail/BurnChart";
import { PredictionsCard } from "@/components/client-detail/PredictionsCard";
import { SprintBreakdown } from "@/components/client-detail/SprintBreakdown";
import { RisksOpportunities } from "@/components/client-detail/RisksOpportunities";
import { CallsTimeline } from "@/components/client-detail/CallsTimeline";
import { NextActions } from "@/components/client-detail/NextActions";
import type { PortfolioSnapshot } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClientDetailClient({ clientId }: { clientId: string }) {
  // Reads from the same SWR cache as the portfolio page — the snapshot is
  // populated whenever Refresh runs and persists across page navigations in
  // the same browser session. We deliberately do NOT revalidate on mount,
  // because /api/portfolio is cache-only (returns an empty snapshot if no
  // server-side cache hit), and on serverless platforms the lambda that
  // served the Refresh may be different from the one serving this fetch.
  const { data } = useSWR<PortfolioSnapshot>("/api/portfolio", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: false,
  });

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
          <p className="text-base font-medium text-slate-700">Loading…</p>
        </div>
      </div>
    );
  }

  const client = data.clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <Link
          href="/portfolio"
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Portfolio
        </Link>
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
          <p className="text-base font-medium text-slate-700">
            {data.clients.length === 0
              ? "Portfolio not loaded yet"
              : `No client "${clientId}"`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {data.clients.length === 0
              ? "Go back and click Refresh first."
              : "Pick a client from the portfolio."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <DealHeader client={client} />

      <div className="grid gap-4 md:grid-cols-2">
        <TimelineCard client={client} />
        <HealthBreakdown client={client} />
      </div>

      <BurnChart project={client.project} />

      <PredictionsCard predictions={client.predictions} />

      <SprintBreakdown sprints={client.project.sprints} />

      <RisksOpportunities
        risks={client.risks}
        opportunities={client.opportunities}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <CallsTimeline
          calls={client.recentCalls}
          emails={client.emailThreads}
        />
        <NextActions actions={client.nextActions} />
      </div>
    </div>
  );
}
