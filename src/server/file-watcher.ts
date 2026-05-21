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

let watcherStarted = false;

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
  const watcher = chokidar.watch(dataDir, {
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

  watcher.on("add", (fp: string) => notify(fp, "add"));
  watcher.on("change", (fp: string) => notify(fp, "change"));

  console.info(`[data-watcher] Watching ${dataDir} for Excel workbooks`);
}

export function isDevWatcherEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
