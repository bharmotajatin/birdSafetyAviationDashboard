import {
  applyOverrides,
  buildDataCheck,
  partitionIssues,
  readCellValue,
  type CellAcceptance,
  type CellOverride,
  type HistoryEntry,
} from "@/lib/data-check";
import { parseWorkbookParts } from "@/lib/parse";
import {
  readAcceptances,
  readHistory,
  readOriginalWorkbook,
  saveAcceptances,
  saveCorrections,
} from "@/server/workbook-repository";

export class DataCheckError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** No auth yet: the name typed on the page ("Your name"), defaulting to "Unknown". */
export function cleanName(name: unknown): string {
  const text = String(name ?? "").trim().slice(0, 80);
  return text || "Unknown";
}

function checkCell(row: number, col: string) {
  if (!Number.isInteger(row) || row < 1) throw new DataCheckError("row must be a positive Excel row number");
  const letter = String(col ?? "").toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(letter)) throw new DataCheckError("col must be an Excel column letter, e.g. BB");
  return letter;
}

async function loadOriginal() {
  const original = await readOriginalWorkbook();
  if (!original) throw new DataCheckError("No workbook is stored (or its original file is unavailable).", 409);
  return original;
}

function fieldLabel(bytes: ArrayBuffer, col: string): string {
  const column = buildDataCheck(bytes).columns.find((c) => c.letter === col);
  return column?.header || col;
}

/** PA-09: current Data Check view (original file + stored corrections). Null when nothing is uploaded. */
export async function getDataCheck() {
  const original = await readOriginalWorkbook();
  if (!original) return null;
  const check = buildDataCheck(applyOverrides(original.bytes, original.overrides));
  const acceptances = await readAcceptances();
  const { open, accepted } = partitionIssues(check.issues, acceptances);
  return {
    fileName: original.fileName,
    overrides: original.overrides,
    ...check,
    issues: open,
    acceptedIssues: accepted,
  };
}

/**
 * Set (or clear, when value equals the original cell / is null) one correction, then re-derive and
 * atomically store the incidents (+ a history row) so every chart reflects it without a re-upload.
 */
export async function setCellOverride(row: number, col: string, value: string | null, by = "Unknown") {
  const letter = checkCell(row, col);
  const original = await loadOriginal();
  const current = applyOverrides(original.bytes, original.overrides);
  const oldValue = readCellValue(current, row, letter);
  const originalValue = readCellValue(original.bytes, row, letter);

  const next: CellOverride[] = original.overrides.filter((o) => !(o.row === row && o.col === letter));
  const trimmed = value == null ? null : String(value).trim();
  const now = new Date().toISOString();
  if (trimmed != null && trimmed !== originalValue) next.push({ row, col: letter, value: trimmed, updatedAt: now });
  const newValue = trimmed ?? originalValue;

  const history: HistoryEntry[] =
    newValue === oldValue
      ? []
      : [
          {
            at: now,
            action: trimmed == null || trimmed === originalValue ? "revert" : "save",
            cell: `${letter}${row}`,
            field: fieldLabel(original.bytes, letter),
            oldValue,
            newValue,
            by: cleanName(by),
          },
        ];
  const { incidents } = parseWorkbookParts(applyOverrides(original.bytes, next));
  await saveCorrections(original.fileName, incidents, next, history);
  return { overrides: next, incidentCount: incidents.length, originalValue };
}

/** PA-09b: accept the cell's current value as genuine. Charts are not affected. */
export async function acceptCell(row: number, col: string, by = "Unknown") {
  const letter = checkCell(row, col);
  const original = await loadOriginal();
  const value = readCellValue(applyOverrides(original.bytes, original.overrides), row, letter);
  const now = new Date().toISOString();
  const name = cleanName(by);
  const acceptances: CellAcceptance[] = [
    ...(await readAcceptances()).filter((a) => !(a.row === row && a.col === letter)),
    { row, col: letter, value, acceptedAt: now, acceptedBy: name },
  ];
  await saveAcceptances(acceptances, [
    { at: now, action: "accept", cell: `${letter}${row}`, field: fieldLabel(original.bytes, letter), oldValue: value, newValue: value, by: name },
  ]);
  return { acceptances };
}

export async function undoAcceptCell(row: number, col: string, by = "Unknown") {
  const letter = checkCell(row, col);
  const original = await loadOriginal();
  const existing = await readAcceptances();
  const target = existing.find((a) => a.row === row && a.col === letter);
  if (!target) throw new DataCheckError(`${letter}${row} has no acceptance to undo.`, 404);
  const acceptances = existing.filter((a) => a !== target);
  await saveAcceptances(acceptances, [
    {
      at: new Date().toISOString(),
      action: "undo-accept",
      cell: `${letter}${row}`,
      field: fieldLabel(original.bytes, letter),
      oldValue: target.value,
      newValue: target.value,
      by: cleanName(by),
    },
  ]);
  return { acceptances };
}

export async function getHistory() {
  return readHistory();
}

export async function getCorrectedWorkbook() {
  const original = await readOriginalWorkbook();
  if (!original) return null;
  const bytes = applyOverrides(original.bytes, original.overrides);
  const base = original.fileName.replace(/\.(xlsx|xlsm|xls)$/i, "");
  return { fileName: `${base}-corrected.xlsx`, bytes };
}