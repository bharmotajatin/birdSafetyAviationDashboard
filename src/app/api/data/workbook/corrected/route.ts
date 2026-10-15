import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { getCorrectedWorkbook } from "@/server/data-check-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PA-09: original workbook with all stored corrections applied. */
export async function GET() {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const file = await getCorrectedWorkbook();
    if (!file) return NextResponse.json({ error: "No workbook stored." }, { status: 404 });
    return new Response(file.bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build corrected workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}