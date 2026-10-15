import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { parseWorkbookParts } from "@/lib/parse";
import { reparseStoredWorkbook } from "@/server/workbook-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AU-02: rebuild saved incidents from the stored original sheet using the current parser. */
export async function POST() {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const workbook = await reparseStoredWorkbook((bytes) => parseWorkbookParts(bytes).incidents);
    if (!workbook) {
      return NextResponse.json(
        { error: "Original sheet is not stored. Please re-upload the workbook once." },
        { status: 409 },
      );
    }
    return NextResponse.json({ workbook, incidentCount: workbook.rowCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to re-parse workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
