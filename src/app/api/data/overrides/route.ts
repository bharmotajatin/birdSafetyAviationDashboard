import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { DataCheckError, getDataCheck, setCellOverride } from "@/server/data-check-service";
import { requestUser } from "@/server/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof DataCheckError) return NextResponse.json({ error: err.message }, { status: err.status });
  const message = err instanceof Error ? err.message : "Failed to save correction.";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** List stored corrections. */
export async function GET() {
  try {
    const result = await getDataCheck();
    return NextResponse.json({ overrides: result?.overrides ?? [] });
  } catch (err) {
    return fail(err);
  }
}

/** Body: { row: 92, col: "BB", value: "DEL" }. A value equal to the original cell removes the correction. */
export async function POST(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { row?: number; col?: string; value?: string | null; by?: string };
    const result = await setCellOverride(
      Number(body.row),
      String(body.col ?? ""),
      body.value ?? null,
      requestUser(request, body.by),
    );
    return NextResponse.json(result);
  } catch (err) {
    return fail(err);
  }
}

/** Revert one cell to the original value: DELETE /api/data/overrides?row=92&col=BB */
export async function DELETE(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const result = await setCellOverride(
      Number(url.searchParams.get("row")),
      url.searchParams.get("col") ?? "",
      null,
      requestUser(request),
    );
    return NextResponse.json(result);
  } catch (err) {
    return fail(err);
  }
}