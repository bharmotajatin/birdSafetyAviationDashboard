import { NextResponse } from "next/server";
import { readOnlyBlock } from "@/server/read-only";
import { acceptCell, DataCheckError, undoAcceptCell } from "@/server/data-check-service";
import { requestUser } from "@/server/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof DataCheckError) return NextResponse.json({ error: err.message }, { status: err.status });
  const message = err instanceof Error ? err.message : "Failed to update acceptance.";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** PA-09b "Accept as is". Body: { row: 12, col: "AC" } — accepts the cell's current value. */
export async function POST(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { row?: number; col?: string; by?: string };
    return NextResponse.json(await acceptCell(Number(body.row), String(body.col ?? ""), requestUser(request, body.by)));
  } catch (err) {
    return fail(err);
  }
}

/** Undo: DELETE /api/data/acceptances?row=12&col=AC */
export async function DELETE(request: Request) {
  const blocked = readOnlyBlock();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await undoAcceptCell(Number(url.searchParams.get("row")), url.searchParams.get("col") ?? "", requestUser(request)),
    );
  } catch (err) {
    return fail(err);
  }
}