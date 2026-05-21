export async function registerNodeShutdown() {
  const { stopDataFolderWatcher } = await import("./src/server/file-watcher");

  const shutdown = () => {
    void stopDataFolderWatcher();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
