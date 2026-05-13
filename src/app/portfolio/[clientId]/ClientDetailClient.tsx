"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { DealHeader } from "@/components/client-detail/DealHeader";
import { HealthBreakdown } from "@/components/client-detail/HealthBreakdown";
import { TimelineCard } from "@/components/client-detail/TimelineCard";
import { BurnChart } from "@/components/client-detail/BurnChart";
import { PredictionsCard } from "@/components/client-detail/PredictionsCard";
import { SprintBreakdown } from "@/components/client-detail/SprintBreakdown";
import { CallsTimeline } from "@/components/client-detail/CallsTimeline";
import { loadSnapshot } from "@/lib/snapshot-storage";
import type { PortfolioSnapshot } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClientDetailClient({ clientId }: { clientId: string }) {
  const { mutate } = useSWRConfig();
  const [hydrated, setHydrated] = useState(false);

  // Reads from the same SWR cache as the portfolio page. We don't revalidate
  // on mount because /api/portfolio is cache-only (returns empty if no
  // server-side cache hit) and on serverless platforms the lambda that
  // served the Refresh may be different from the one serving this fetch.
  const { data } = useSWR<PortfolioSnapshot>("/api/portfolio", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: false,
  });

  // Hydrate from localStorage on mount — survives full page reloads.
  useEffect(() => {
    const persisted = loadSnapshot();
    if (persisted && persisted.clients.length > 0) {
      mutate("/api/portfolio", persisted, { revalidate: false });
    }
    setHydrated(true);
  }, [mutate]);

  // Briefly show a loading state until we know whether localStorage has data.
  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
          <p className="text-base font-medium text-slate-700">Loading…</p>
        </div>
      </div>
    );
  }

  const client = data?.clients.find((c) => c.id === clientId);

  if (!client) {
    const isPortfolioEmpty = !data || data.clients.length === 0;
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <Link
          href="/portfolio"
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← Portfolio
        </Link>
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
          <p className="text-base font-medium text-slate-700">
            {isPortfolioEmpty
              ? "Portfolio not loaded yet"
              : `No client "${clientId}"`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isPortfolioEmpty
              ? "Go back and click Refresh first."
              : "Pick a client from the portfolio."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <DealHeader client={client} />

      <div className="grid gap-4 md:grid-cols-2">
        <TimelineCard client={client} />
        <HealthBreakdown client={client} />
      </div>

      <BurnChart project={client.project} />

      <PredictionsCard predictions={client.predictions} />

      <SprintBreakdown sprints={client.project.sprints} />

      <CallsTimeline
        calls={client.recentCalls}
        emails={client.emailThreads}
        risks={client.risks}
        opportunities={client.opportunities}
        hubspotPortalId={data?.hubspotPortalId}
        hubspotDealId={client.deal.id}
      />
    </div>
  );
}
