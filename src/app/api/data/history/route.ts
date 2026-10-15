import { NextResponse } from "next/server";
import { getHistory } from "@/server/data-check-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PA-09b: Data Check change history, newest first (times in UTC). Append-only: there is no delete. */
export async function GET() {
  try {
    return NextResponse.json({ history: await getHistory() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
