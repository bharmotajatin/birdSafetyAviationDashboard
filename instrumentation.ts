/**
 * Edge-safe instrumentation entry. Node-only shutdown hooks live in
 * instrumentation.node.ts and are loaded only when NEXT_RUNTIME is nodejs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerNodeShutdown } = await import("./instrumentation.node");
  await registerNodeShutdown();
}
