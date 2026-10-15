/**
 * View-only mode for the published site. Off unless the env flag is "1".
 * - NEXT_PUBLIC_READ_ONLY is inlined into the browser bundle at build time (hides edit/upload UI).
 * - READ_ONLY (or NEXT_PUBLIC_READ_ONLY) is read by the server at request time (403 on writes, masked data).
 */
export const READ_ONLY_CLIENT = process.env.NEXT_PUBLIC_READ_ONLY === "1";

export function isReadOnlyServer(): boolean {
  return process.env.READ_ONLY === "1" || process.env.NEXT_PUBLIC_READ_ONLY === "1";
}
