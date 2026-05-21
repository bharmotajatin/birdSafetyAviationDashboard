"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

type FileSnapshot = { name: string; mtimeMs: number };

const isDev = process.env.NODE_ENV === "development";

export function DataFolderWatcher() {
  const mergeFromDataFile = useDashboardStore((s) => s.mergeFromDataFile);
  const processingRef = useRef(new Set<string>());
  const lastSnapshotsRef = useRef<Map<string, number>>(new Map());

  const ingestFile = async (fileName: string) => {
    if (processingRef.current.has(fileName)) return;
    processingRef.current.add(fileName);

    try {
      const result = await mergeFromDataFile(fileName);
      if (result.blocked) {
        toast.error(
          `Validation failed for ${fileName}. Fix errors or use Load Anyway on the validation panel.`,
          { duration: 6000 },
        );
        return;
      }
      if (result.added > 0) {
        toast.success(
          `Added ${result.added} new incident${result.added === 1 ? "" : "s"} from ${result.fileName}`,
          { duration: 5000 },
        );
      } else {
        toast(
          `No new incidents in ${result.fileName} (${result.skipped} duplicate row${result.skipped === 1 ? "" : "s"} skipped)`,
          { icon: "ℹ️",
            duration: 4000,
          },
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load workbook from /data";
      toast.error(message);
    } finally {
      processingRef.current.delete(fileName);
    }
  };

  useEffect(() => {
    if (!isDev) return;

    const source = new EventSource("/api/data/watch");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          fileName?: string;
        };
        if (payload.type === "file-update" && payload.fileName) {
          void ingestFile(payload.fileName);
        }
      } catch {
        /* ignore malformed SSE payloads */
      }
    };

    source.onerror = () => {
      /* EventSource reconnects automatically */
    };

    return () => {
      source.close();
    };
  }, [mergeFromDataFile]);

  // Production: poll /data for mtime changes. Dev uses chokidar SSE above.
  useEffect(() => {
    if (isDev) return;

    const pollMs = 4000;

    const poll = async () => {
      try {
        const res = await fetch("/api/data/files");
        const json = await res.json();
        if (!res.ok || !Array.isArray(json.files)) return;

        const files = json.files as FileSnapshot[];
        const prev = lastSnapshotsRef.current;

        for (const file of files) {
          const lastMtime = prev.get(file.name);
          if (lastMtime === undefined) {
            prev.set(file.name, file.mtimeMs);
            await ingestFile(file.name);
          } else if (lastMtime !== file.mtimeMs) {
            prev.set(file.name, file.mtimeMs);
            await ingestFile(file.name);
          }
        }
      } catch {
        /* polling is best-effort */
      }
    };

    void poll();
    const id = setInterval(() => void poll(), pollMs);
    return () => clearInterval(id);
  }, [mergeFromDataFile]);

  return null;
}
