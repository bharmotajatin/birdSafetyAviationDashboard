import {
  dataWatchEmitter,
  isDevWatcherEnabled,
  startDataFolderWatcher,
} from "@/server/file-watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDevWatcherEnabled()) {
    return new Response("Data folder SSE is only available in development.", {
      status: 404,
    });
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
}
