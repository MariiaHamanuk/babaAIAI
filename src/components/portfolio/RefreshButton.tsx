"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { saveSnapshot } from "@/lib/snapshot-storage";

type Phase = "idle" | "fetch" | "sentiment" | "actions" | "predict" | "done" | "error";

const phaseLabels: Record<Phase, string> = {
  idle: "Refresh",
  fetch: "Fetching",
  sentiment: "Analyzing communications",
  actions: "Generating actions",
  predict: "Forecasting",
  done: "Done",
  error: "Error",
};

type ProgressInfo = {
  phase: Phase;
  message?: string;
  done?: number;
  total?: number;
};

export function RefreshButton() {
  const { mutate } = useSWRConfig();
  const [progress, setProgress] = useState<ProgressInfo>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [errorAt, setErrorAt] = useState<string | null>(null);
  const [errorPhase, setErrorPhase] = useState<Phase | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  // Tracks the most recent phase synchronously so SSE handlers can read it
  // without relying on stale React state from their captured closure.
  const phaseRef = useRef<Phase>("idle");
  // EventSource fires an extra "error" when the connection closes after our
  // server-side error event; this guard prevents that duplicate from
  // overwriting the original message.
  const errorHandledRef = useRef(false);

  useEffect(() => () => sourceRef.current?.close(), []);

  function start() {
    if (progress.phase !== "idle" && progress.phase !== "done" && progress.phase !== "error")
      return;

    setError(null);
    setErrorAt(null);
    setErrorPhase(null);
    phaseRef.current = "fetch";
    errorHandledRef.current = false;
    setProgress({ phase: "fetch" });
    const es = new EventSource("/api/refresh");
    sourceRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      phaseRef.current = data.phase;
      setProgress({
        phase: data.phase,
        message: data.message,
        done: data.progress?.done,
        total: data.progress?.total,
      });
    });

    es.addEventListener("snapshot", (e) => {
      const snapshot = JSON.parse((e as MessageEvent).data);
      mutate("/api/portfolio", snapshot, { revalidate: false });
      // Persist for full page reloads / new tabs on serverless.
      saveSnapshot(snapshot);
    });

    es.addEventListener("done", () => {
      phaseRef.current = "done";
      setProgress({ phase: "done" });
      es.close();
      sourceRef.current = null;
      setTimeout(() => {
        phaseRef.current = "idle";
        setProgress({ phase: "idle" });
      }, 1500);
    });

    es.addEventListener("error", (e) => {
      // EventSource fires a second "error" right after we close the
      // connection on the first. Ignore it.
      if (errorHandledRef.current) return;
      errorHandledRef.current = true;

      const phaseAtError = phaseRef.current;
      const msg = (e as MessageEvent).data
        ? (() => {
            try {
              return JSON.parse((e as MessageEvent).data).message ?? "Unknown error";
            } catch {
              return "Connection error";
            }
          })()
        : "Connection error";
      console.error("[refresh] failed during", phaseAtError, ":", msg);
      setError(msg);
      setErrorAt(new Date().toLocaleTimeString());
      setErrorPhase(phaseAtError === "idle" ? null : phaseAtError);
      phaseRef.current = "error";
      setProgress({ phase: "error" });
      es.close();
      sourceRef.current = null;
    });
  }

  function copyError() {
    if (!error) return;
    navigator.clipboard?.writeText(error).catch(() => {});
  }

  function dismissError() {
    setError(null);
    setErrorAt(null);
    setErrorPhase(null);
    setProgress({ phase: "idle" });
  }

  const busy =
    progress.phase !== "idle" &&
    progress.phase !== "done" &&
    progress.phase !== "error";
  const showProgress = busy || progress.phase === "done";
  const pct =
    progress.total && progress.total > 0
      ? Math.round((progress.done ?? 0) / progress.total * 100)
      : null;

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center">
        {showProgress ? (
          <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-200 sm:w-[260px]">
            <div className="flex items-center justify-between text-slate-600">
              <span className="truncate">
                {progress.message ?? phaseLabels[progress.phase]}
              </span>
              {pct !== null ? (
                <span className="ml-2 shrink-0 tabular-nums text-slate-500">
                  {progress.done}/{progress.total}
                </span>
              ) : null}
            </div>
            {pct !== null ? (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          onClick={start}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          <svg
            className={`size-4 ${busy ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12a9 9 0 0 1 15.49-6.36L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.49 6.36L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          <span>{phaseLabels[progress.phase]}</span>
        </button>
      </div>

      {error ? (
        <div className="w-full max-w-xl rounded-lg bg-rose-50 p-3 text-xs text-rose-800 ring-1 ring-rose-200">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold">
              Refresh failed
              {errorPhase ? (
                <span className="ml-1 font-normal text-rose-600">
                  during {errorPhase}
                </span>
              ) : null}
              {errorAt ? (
                <span className="ml-1 font-normal text-rose-500">
                  · {errorAt}
                </span>
              ) : null}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={copyError}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                title="Copy error message"
              >
                Copy
              </button>
              <button
                onClick={dismissError}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                title="Dismiss"
              >
                Dismiss
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-rose-900">
            {error}
          </pre>
          <p className="mt-2 text-[11px] text-rose-700/80">
            Full error also logged to the browser console.
          </p>
        </div>
      ) : null}
    </div>
  );
}
