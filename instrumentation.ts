export async function register() {
  if (process.env.NODE_ENV === "development") {
    const { startDataFolderWatcher } = await import("@/server/file-watcher");
    await startDataFolderWatcher();
  }
}
