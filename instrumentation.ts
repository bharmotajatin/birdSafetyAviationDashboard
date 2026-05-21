/**
 * Keep this file Edge-safe. Next.js evaluates instrumentation for both Node and
 * Edge in dev; do not import fs, path, chokidar, or @/server/* here.
 *
 * The /data folder watcher is started from src/app/api/data/watch/route.ts
 * (runtime: nodejs) when DataFolderWatcher connects via EventSource in development.
 */
export async function register() {
  // No-op
}
