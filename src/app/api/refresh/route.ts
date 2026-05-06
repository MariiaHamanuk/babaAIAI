import type { NextRequest } from "next/server";
import { bustPortfolioCache, runRefresh } from "@/lib/data/getPortfolio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream:
 *   event: status      — progress updates from each phase (fetch / sentiment / actions / predict)
 *   event: snapshot    — the final PortfolioSnapshot payload
 *   event: error       — terminal error
 *   event: done        — pipeline finished
 *
 * UI uses EventSource to subscribe and update the SWR cache when `snapshot` arrives.
 */
export async function GET(_req: NextRequest) {
  await bustPortfolioCache();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // Client disconnected; mark closed so we stop trying.
          closed = true;
        }
      };

      const send = (event: string, data: unknown) => {
        safeEnqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Periodic comment to keep some proxies from buffering
      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      try {
        const snapshot = await runRefresh((event) => send("status", event));
        send("snapshot", snapshot);
        send("done", {});
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        send("error", { message });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      // Client aborted (closed the tab / called EventSource.close());
      // there's no controller reference here, but the closure above
      // sees `closed = true` once enqueue throws on the next attempt.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
