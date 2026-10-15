import { NextResponse } from "next/server";
import { isReadOnlyServer } from "@/lib/read-only";
import { HIDDEN, makeRedactor } from "@/lib/analysis-excel/privacy";
import { maskPersonalData } from "@/lib/analysis-excel/privacy";
import type { Incident } from "@/lib/types";
import { normalizeId } from "@/lib/analyses";

/** Stable pseudonyms ("Staff #1", ...) per distinct normalised value, in order of first appearance; blanks stay blank. */
export function pseudonymize(values: (string | undefined)[], prefix: string): string[] {
  const ids = new Map<string, number>();
  return values.map((v) => {
    const key = normalizeId(v);
    if (!key) return "";
    if (!ids.has(key)) ids.set(key, ids.size + 1);
    return `${prefix} #${ids.get(key)}`;
  });
}

/** 403 response when the site is in view-only mode, otherwise null. */
export function readOnlyBlock(): NextResponse | null {
  return isReadOnlyServer()
    ? NextResponse.json({ error: "This site is view only. Changes are not allowed." }, { status: 403 })
    : null;
}

const FREE_TEXT: (keyof Incident)[] = ["title", "brief", "rootCause", "correctiveAction", "immediateAction", "preventiveAction", "location", "contributingFactor"];

/** View-only: person and staff fields hidden, and their names/numbers redacted from the free text. */
export function maskIncidentsForView(incidents: Incident[]): Incident[] {
  const people = incidents.map((i) => i.personInvolved).filter((v) => v && v.trim().length > 2);
  const staff = incidents.map((i) => i.staffNo ?? "").filter((v) => v && v.trim().length > 2);
  const tokens = people.flatMap((p) => p.split(/[\s,./&]+/)).filter((t) => /^[A-Za-z]{3,}$/.test(t));
  const redact = makeRedactor({ values: [...people, ...staff], nameTokens: tokens, staffIds: staff });
  // Pseudonyms keep the Repeat page grouping working without exposing real staff numbers.
  const staffAlias = pseudonymize(incidents.map((i) => i.staffNo), "Staff");
  return incidents.map((i, idx) => {
    const out: Incident = { ...i, personInvolved: i.personInvolved ? HIDDEN : "", staffNo: staffAlias[idx] ?? "" };
    for (const k of FREE_TEXT) {
      const v = out[k];
      if (typeof v === "string" && v) (out as Record<string, unknown>)[k] = redact(v);
    }
    return out;
  });
}

type GridLike = { columns?: { header: string }[]; rows?: { row: number; cells: string[] }[] };

/** View-only: mask the Data Check sheet grid with the same rules as the Analysis Excel export. */
export function maskGridForView<T extends GridLike>(result: T): T {
  if (!result.columns || !result.rows) return result;
  const matrix: unknown[][] = [result.columns.map((c) => c.header), ...result.rows.map((r) => r.cells)];
  const masked = maskPersonalData(matrix).rows;
  return { ...result, rows: result.rows.map((r, i) => ({ ...r, cells: (masked[i + 1] ?? r.cells).map((c) => String(c ?? "")) })) };
}
