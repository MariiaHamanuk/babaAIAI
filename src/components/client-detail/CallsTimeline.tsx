"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import type {
  Call,
  EmailThread,
  OpportunityItem,
  RiskItem,
  Sentiment,
} from "@/lib/types";
import { ShowMore } from "./ShowMore";

type Item =
  | { kind: "call"; data: Call }
  | { kind: "email"; data: EmailThread };

const kindStyle: Record<Item["kind"], { label: string; tone: string }> = {
  call: { label: "Call", tone: "bg-slate-100 text-slate-700" },
  email: { label: "Email", tone: "bg-slate-100 text-slate-700" },
};

// Three labels carry the direction (NEG / NEU / POS); the chip's color
// shade carries the intensity (darker rose / emerald = "very").
const sentimentChip: Record<
  NonNullable<Sentiment["label"]>,
  { label: string; tone: string }
> = {
  very_negative: { label: "NEG", tone: "bg-rose-300 text-rose-900" },
  negative: { label: "NEG", tone: "bg-rose-100 text-rose-700" },
  neutral: { label: "NEU", tone: "bg-slate-100 text-slate-600" },
  positive: { label: "POS", tone: "bg-emerald-100 text-emerald-700" },
  very_positive: { label: "POS", tone: "bg-emerald-300 text-emerald-900" },
};

const sevTone: Record<RiskItem["severity"], string> = {
  high: "bg-rose-200 text-rose-800",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

// HubSpot link — point to the parent DEAL page, which always exists and
// shows the engagement in its activity feed. Standalone /record/0-48/{callId}
// URLs are unreliable across HubSpot plans, so this is the safe target.
function hubspotDealUrl(
  portalId: string | undefined,
  dealId: string | undefined,
): string | null {
  if (!portalId || !dealId) return null;
  return `https://app.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`;
}

function risksFor(item: Item, risks: RiskItem[]): RiskItem[] {
  const target = `risk-${item.data.id}`;
  return risks.filter((r) => r.id === target);
}

function oppsFor(item: Item, opportunities: OpportunityItem[]): OpportunityItem[] {
  const target = `opp-${item.data.id}`;
  return opportunities.filter((o) => o.id === target);
}

export function CallsTimeline({
  calls,
  emails,
  risks,
  opportunities,
  hubspotPortalId,
  hubspotDealId,
}: {
  calls: Call[];
  emails: EmailThread[];
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  hubspotPortalId?: string;
  hubspotDealId?: string;
}) {
  const [selected, setSelected] = useState<Item | null>(null);

  const items: Item[] = [
    ...calls.map((c) => ({ kind: "call" as const, data: c })),
    ...emails.map((e) => ({ kind: "email" as const, data: e })),
  ].sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">Recent activity</h3>
        <p className="mt-2 text-sm text-slate-500">No recent calls or emails.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Recent activity
      </h3>
      <ol className="flex flex-1 flex-col space-y-2.5">
        <ShowMore>
          {items.map((it) => {
            const kind = kindStyle[it.kind];
            const sent = it.data.sentiment;
            const body =
              it.kind === "call" ? it.data.notes : it.data.snippet;
            const rN = risksFor(it, risks).length;
            const oN = oppsFor(it, opportunities).length;
            return (
              <li key={it.data.id}>
                <button
                  type="button"
                  onClick={() => setSelected(it)}
                  className="w-full rounded-lg bg-slate-50/60 p-3 text-left transition hover:bg-slate-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span
                      className={`inline-flex w-14 shrink-0 justify-center rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider ${kind.tone}`}
                    >
                      {kind.label}
                    </span>
                    {sent ? (
                      <span
                        className={`inline-flex w-16 shrink-0 justify-center rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider ${sentimentChip[sent.label].tone}`}
                      >
                        {sentimentChip[sent.label].label}
                      </span>
                    ) : null}
                    <span className="text-slate-500">
                      {fmtDate(it.data.date)}
                    </span>
                    {rN > 0 ? (
                      <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                        {rN} risk{rN === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {oN > 0 ? (
                      <span
                        className={`${rN === 0 ? "ml-auto" : ""} rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700`}
                      >
                        {oN} opp{oN === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-sm text-slate-800">
                    {body}
                  </div>
                </button>
              </li>
            );
          })}
        </ShowMore>
      </ol>

      {selected ? (
        <DetailsModal
          item={selected}
          risks={risksFor(selected, risks)}
          opportunities={oppsFor(selected, opportunities)}
          hubspotPortalId={hubspotPortalId}
          hubspotDealId={hubspotDealId}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function DetailsModal({
  item,
  risks,
  opportunities,
  hubspotPortalId,
  hubspotDealId,
  onClose,
}: {
  item: Item;
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  hubspotPortalId?: string;
  hubspotDealId?: string;
  onClose: () => void;
}) {
  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sent = item.data.sentiment;
  const body =
    item.kind === "call" ? item.data.notes : item.data.snippet;
  const headline =
    item.kind === "call"
      ? `Call${item.data.participants?.length ? ` with ${item.data.participants.join(", ")}` : ""}`
      : `Email — ${item.data.subject || "(no subject)"}`;
  const link = hubspotDealUrl(hubspotPortalId, hubspotDealId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {fmtDate(item.data.date)}
            </div>
            <h4 className="mt-0.5 text-base font-semibold text-slate-800">
              {headline}
            </h4>
            {sent ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span
                  className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider ${sentimentChip[sent.label].tone}`}
                >
                  {sent.label.replace("_", " ")}
                </span>
                {sent.riskFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded bg-rose-50 px-1.5 py-0.5 font-medium uppercase tracking-wider text-rose-700"
                  >
                    {flag}
                  </span>
                ))}
                {sent.opportunitySignals.map((flag) => (
                  <span
                    key={flag}
                    className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium uppercase tracking-wider text-emerald-700"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm">
          <section>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
              {item.kind === "call" ? "Call notes" : "Email body"}
            </div>
            <p className="whitespace-pre-wrap text-slate-800">{body}</p>
            {sent?.rationale &&
            risks.length === 0 &&
            opportunities.length === 0 ? (
              <p className="mt-2 rounded bg-slate-50 p-2 text-xs italic text-slate-500">
                <span className="font-medium">AI read:</span> {sent.rationale}
              </p>
            ) : null}
          </section>

          {risks.length > 0 ? (
            <section>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">
                Risks from this {item.kind}
              </div>
              <ul className="space-y-1.5">
                {risks.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md bg-rose-50/60 px-3 py-2 text-xs text-rose-900"
                  >
                    <span
                      className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sevTone[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                    {r.description}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {opportunities.length > 0 ? (
            <section>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">
                Opportunities from this {item.kind}
              </div>
              <ul className="space-y-1.5">
                {opportunities.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-md bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900"
                  >
                    {o.description}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {link ? (
          <div className="border-t border-slate-100 bg-slate-50/60 p-3 text-right text-xs">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
            >
              Open deal in HubSpot ↗
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
