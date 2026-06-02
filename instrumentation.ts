/**
 * Edge-safe instrumentation entry. Next.js evaluates this file for both Node and
 * Edge in dev — do not import fs, path, chokidar, process.on, or @/server/* here.
 *
 * Data-folder watcher lifecycle: started from /api/data/watch (nodejs); shutdown
 * hooks are registered in src/server/file-watcher.ts on first start.
 */
export async function register() {
  // No-op
}
