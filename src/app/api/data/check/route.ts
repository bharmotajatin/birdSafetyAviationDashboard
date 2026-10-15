import { NextResponse } from "next/server";
import { getDataCheck } from "@/server/data-check-service";
import { maskGridForView } from "@/server/read-only";
import { isReadOnlyServer } from "@/lib/read-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PA-09: issues + sheet grid for the Data Check page. */
export async function GET() {
  try {
    const result = await getDataCheck();
    if (!result) return NextResponse.json({ error: "No workbook uploaded." }, { status: 404 });
    return NextResponse.json(isReadOnlyServer() ? maskGridForView(result) : result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run data check.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}