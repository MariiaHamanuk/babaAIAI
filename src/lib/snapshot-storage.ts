/**
 * Client-side persistence for the portfolio snapshot.
 *
 * Why: the server-side in-memory cache is per-lambda on Vercel, so a full
 * page reload often hits a fresh lambda and gets an empty snapshot back.
 * Persisting in localStorage keeps the data visible across reloads + tabs
 * within the same browser session, without needing Vercel KV yet.
 */
import type { PortfolioSnapshot } from "./types";

const KEY = "babadash:snapshot:v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type Stored = {
  savedAt: number;
  snapshot: PortfolioSnapshot;
};

export function loadSnapshot(): PortfolioSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.snapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { savedAt: Date.now(), snapshot };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage quota exceeded or disabled in browser — silently skip
  }
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
