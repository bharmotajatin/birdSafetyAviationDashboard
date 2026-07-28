import {
  dataWatchEmitter,
  isDevWatcherEnabled,
  startDataFolderWatcher,
} from "@/server/file-watcher";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE stream for /data folder changes (development only). */
export async function GET(request: Request) {
  try {
    if (!isDevWatcherEnabled()) {
      return NextResponse.json(
        { error: "Data folder SSE is only available in development." },
        { status: 404 },
      );
    }

    await startDataFolderWatcher();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const send = (payload: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const onUpdate = (payload: { fileName: string; event: string }) => {
          send({ type: "file-update", fileName: payload.fileName, event: payload.event });
        };

        dataWatchEmitter.on("update", onUpdate);
        send({ type: "connected" });

        const heartbeat = setInterval(() => {
          send({ type: "heartbeat", at: Date.now() });
        }, 25000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          dataWatchEmitter.off("update", onUpdate);
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
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start data folder watcher.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
