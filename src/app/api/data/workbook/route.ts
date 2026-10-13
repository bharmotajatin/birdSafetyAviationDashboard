import { NextResponse } from "next/server";
import { parseWorkbookParts } from "@/lib/parse";
import {
  clearWorkbookStore,
  readWorkbook,
  saveWorkbook,
} from "@/server/workbook-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;

export async function GET() {
  try {
    const stored = await readWorkbook();
    return NextResponse.json(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing workbook file." }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".xlsm")) {
      return NextResponse.json(
        { error: "Please upload a GHR Excel workbook (.xlsx or .xls only)." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Workbook is larger than 50 MB." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const { incidents } = parseWorkbookParts(bytes);
    const workbook = await saveWorkbook(file.name, bytes, incidents);
    return NextResponse.json({ workbook, incidentCount: incidents.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to store workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearWorkbookStore();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
