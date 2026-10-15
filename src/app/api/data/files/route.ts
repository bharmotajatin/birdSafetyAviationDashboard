import { NextResponse } from "next/server";
import { listDataWorkbooks } from "@/server/data-folder";
import { readWorkbookSource } from "@/server/workbook-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists workbooks in /data with mtimes (production polling fallback).
 * On Cloudflare Workers there is no writable file system (fs.mkdir fails with EPERM), so it
 * reports the workbook stored in D1 instead, with no /data files to ingest.
 */
export async function GET() {
  try {
    const src = await readWorkbookSource();
    if (src.source === "d1") {
      return NextResponse.json({ files: [], source: "d1", workbook: src.workbook }, { headers: { "Cache-Control": "no-store" } });
    }
    const files = await listDataWorkbooks();
    return NextResponse.json({ files, source: "local" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list data folder.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
