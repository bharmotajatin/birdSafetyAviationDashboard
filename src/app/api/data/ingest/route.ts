import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { readWorkbookFromDataFolder } from "@/server/data-folder";
import { parseWorkbookParts } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns parsed incidents from a workbook in /data (client merges into store). */
export async function GET(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  const fileName = new URL(request.url).searchParams.get("file");
  if (!fileName) {
    return NextResponse.json({ error: "Missing file query parameter." }, { status: 400 });
  }

  try {
    const { buffer, fileName: safeName } = await readWorkbookFromDataFolder(fileName);
    const { incidents, contributingFromSheet } = parseWorkbookParts(buffer);

    return NextResponse.json({
      fileName: safeName,
      incidentCount: incidents.length,
      incidents,
      contributingFromSheet,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read workbook from data folder.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
