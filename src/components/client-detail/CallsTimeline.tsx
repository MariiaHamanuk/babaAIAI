import { fmtDate, sentimentColor } from "@/lib/format";
import type { Call, EmailThread } from "@/lib/types";

type Item =
  | { kind: "call"; data: Call }
  | { kind: "email"; data: EmailThread };

export function CallsTimeline({
  calls,
  emails,
}: {
  calls: Call[];
  emails: EmailThread[];
}) {
  const items: Item[] = [
    ...calls.map((c) => ({ kind: "call" as const, data: c })),
    ...emails.map((e) => ({ kind: "email" as const, data: e })),
  ].sort(
    (a, b) =>
      new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">Recent activity</h3>
        <p className="mt-2 text-sm text-slate-500">No recent calls or emails.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Recent activity
      </h3>
      <ol className="space-y-3">
        {items.map((it) => {
          const sentiment = it.data.sentiment;
          const headline =
            it.kind === "call"
              ? `Call · ${it.data.participants.join(", ")}`
              : `Email · ${it.data.subject}`;
          const body =
            it.kind === "call" ? it.data.notes : it.data.snippet;
          return (
            <li
              key={it.data.id}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  {fmtDate(it.data.date)} · {headline}
                </span>
                {sentiment ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sentimentColor(sentiment.label)}`}
                  >
                    {sentiment.label.replace("_", " ")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-slate-700">{body}</p>
              {sentiment?.riskFlags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {sentiment.riskFlags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
