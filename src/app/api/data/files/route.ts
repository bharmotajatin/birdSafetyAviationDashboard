import { NextResponse } from "next/server";
import { listDataWorkbooks } from "@/server/data-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists workbooks in /data with mtimes (production polling fallback). */
export async function GET() {
  try {
    const files = await listDataWorkbooks();
    return NextResponse.json({ files });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list data folder.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
