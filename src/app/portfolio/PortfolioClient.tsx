"use client";

import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { KpiStrip } from "@/components/portfolio/KpiStrip";
import { HealthDistribution } from "@/components/portfolio/HealthDistribution";
import { AtRiskList } from "@/components/portfolio/AtRiskList";
import { ClientGrid } from "@/components/portfolio/ClientGrid";
import { RefreshButton } from "@/components/portfolio/RefreshButton";
import { loadSnapshot } from "@/lib/snapshot-storage";
import type { PortfolioSnapshot } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PortfolioClient({
  initial,
}: {
  initial: PortfolioSnapshot;
}) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<PortfolioSnapshot>("/api/portfolio", fetcher, {
    fallbackData: initial,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: false,
    dedupingInterval: 30_000,
  });

  // Hydrate from localStorage on mount — survives full page reloads on
  // serverless (where the in-memory server cache might be empty).
  useEffect(() => {
    const persisted = loadSnapshot();
    if (persisted && persisted.clients.length > 0) {
      mutate("/api/portfolio", persisted, { revalidate: false });
    }
  }, [mutate]);

  const snap = data ?? initial;
  const isEmpty = snap.clients.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            BotsCrew OS
          </h1>
          <p className="text-xs text-slate-500">
            {isEmpty ? (
              "No data yet — click Refresh to fetch."
            ) : (
              <>
                Generated{" "}
                <time dateTime={snap.generatedAt} suppressHydrationWarning>
                  {new Date(snap.generatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </>
            )}
          </p>
        </div>
        <RefreshButton />
      </header>

      {isEmpty ? (
        <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200">
          <p className="text-base font-medium text-slate-700">
            Portfolio not loaded yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Click <span className="font-medium text-slate-700">Refresh</span> to
            pull live data, classify communications, and generate forecasts.
          </p>
        </div>
      ) : (
        <>
          <KpiStrip snap={snap} />

          <div className="grid gap-4 md:grid-cols-2">
            <HealthDistribution clients={snap.clients} />
            <AtRiskList clients={snap.clients} />
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              All Clients
            </h2>
            <ClientGrid clients={snap.clients} />
          </section>
        </>
      )}
    </div>
  );
}
