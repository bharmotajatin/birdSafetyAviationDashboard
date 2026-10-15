import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { readWorkbookFromDataFolder } from "@/server/data-folder";
import { validateWorkbook } from "@/lib/validation/workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  const fileName = new URL(request.url).searchParams.get("file");
  if (!fileName) {
    return NextResponse.json({ error: "Missing file query parameter." }, { status: 400 });
  }

  try {
    const { buffer, fileName: safeName } = await readWorkbookFromDataFolder(fileName);
    const validation = validateWorkbook(buffer, safeName);
    return NextResponse.json(validation);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to validate workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
