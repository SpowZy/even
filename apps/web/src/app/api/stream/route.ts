import { getStore } from "@/lib/server/store";
import { subscribe } from "@/lib/server/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/stream — server-sent events. Replays the current runs, then
// forwards every run/receipt event live, with a 15s heartbeat.
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const store = getStore();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const runs = await store.listRuns();
      for (const run of runs) send("run", run);

      const unsubscribe = subscribe((event) => send(event.type, event.data));
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        controller.close();
      });
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
