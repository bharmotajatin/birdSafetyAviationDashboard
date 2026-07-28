import { EventEmitter } from "events";
import path from "path";
import {
  ensureDataDirectory,
  getDataDirectory,
  isWorkbookFileName,
} from "@/server/data-folder";

export type DataFileWatchEvent = {
  fileName: string;
  filePath: string;
  event: "add" | "change";
};

export const dataWatchEmitter = new EventEmitter();
dataWatchEmitter.setMaxListeners(50);

import type { FSWatcher } from "chokidar";

let watcherStarted = false;
let shutdownHooksRegistered = false;
let activeWatcher: FSWatcher | null = null;

const recentEmit = new Map<string, number>();
const EMIT_DEBOUNCE_MS = 1500;

function shouldEmit(fileName: string): boolean {
  const now = Date.now();
  const last = recentEmit.get(fileName) ?? 0;
  if (now - last < EMIT_DEBOUNCE_MS) return false;
  recentEmit.set(fileName, now);
  return true;
}

function notify(filePath: string, event: "add" | "change") {
  const fileName = path.basename(filePath);
  if (!isWorkbookFileName(fileName)) return;
  if (!shouldEmit(fileName)) return;

  const payload: DataFileWatchEvent = { fileName, filePath, event };
  dataWatchEmitter.emit("update", payload);
}

export async function startDataFolderWatcher(): Promise<void> {
  if (watcherStarted) return;
  watcherStarted = true;

  await ensureDataDirectory();
  const dataDir = getDataDirectory();

  const chokidar = await import("chokidar");
  activeWatcher = chokidar.watch(dataDir, {
    persistent: true,
    ignoreInitial: false,
    usePolling: true,
    interval: 1000,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 200,
    },
    ignored: (watchPath) => {
      const base = path.basename(String(watchPath));
      return base.startsWith("~$") || base === ".gitkeep";
    },
  });

  activeWatcher.on("add", (fp: string) => notify(fp, "add"));
  activeWatcher.on("change", (fp: string) => notify(fp, "change"));

  if (process.env.NODE_ENV === "development") {
    console.info(`[data-watcher] Watching ${dataDir} for Excel workbooks`);
  }

  if (!shutdownHooksRegistered) {
    shutdownHooksRegistered = true;
    const shutdown = () => {
      void stopDataFolderWatcher();
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

export async function stopDataFolderWatcher(): Promise<void> {
  if (!activeWatcher) return;
  await activeWatcher.close();
  activeWatcher = null;
  watcherStarted = false;
}

export function isDevWatcherEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
