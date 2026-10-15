import * as XLSX from "xlsx";
import { applyOverrides, buildDataCheck, readCellValue, toExcelCol, toExcelRow } from "@/lib/data-check";
import { parseWorkbookParts } from "@/lib/parse";

/** Incident Log like the real sheet: title rows, group header on row 3, field headers on row 4. */
function makeWorkbook(): ArrayBuffer {
  const headers = ["S.No.", "Incident Title", "GHR No.", "Date of Incident", "Incident Type", "Incident Category", "Status", ""];
  const aoa = [
    ["GHR INCIDENT LOG"],
    [],
    ["PART-A"],
    headers,
    [1, "Bag fell", "G-1", "2026-01-05", "GSE Damage", "CAT-C", "Closed", "DEL"],
    [2, "Tug hit", "G-2", "2026-01-06", "NONE", "NIL", "", "COK"],
    [3, "Slip", "G-3", "2026-01-07", "Slip/Trip", "", "Pending", ""],
    [4, "Near miss", "G-4", "2026-01-08", "Near Miss", "CAT-D", "Closed", "BLR"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Incident Log");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("data check row/column mapping", () => {
  it("converts matrix indexes to Excel row numbers and column letters", () => {
    expect(toExcelRow(0)).toBe(1);
    expect(toExcelRow(91)).toBe(92);
    expect(toExcelCol(0)).toBe("A");
    expect(toExcelCol(28)).toBe("AC");
    expect(toExcelCol(32)).toBe("AG");
    expect(toExcelCol(52)).toBe("BA");
    expect(toExcelCol(53)).toBe("BB");
  });

  it("reports issues at the real Excel cell with the header name", () => {
    const check = buildDataCheck(makeWorkbook());
    expect(check.headerRow).toBe(4);
    const cells = check.issues.map((i) => `${i.cell}:${i.field}`).sort();
    expect(cells).toEqual(["E6:incidentType", "F6:category", "F7:category", "G6:status", "H7:station"].sort());
    const station = check.issues.find((i) => i.field === "station")!;
    expect(station).toMatchObject({ row: 7, col: "H", serialNo: 3, value: "" });
    expect(check.issues.find((i) => i.cell === "E6")!.header).toBe("Incident Type");
    expect(check.options.station).toEqual(expect.arrayContaining(["BLR", "COK", "DEL"]));
  });
});

describe("overrides", () => {
  it("applies corrections to the original workbook and re-applies them on every parse", () => {
    const original = makeWorkbook();
    const overrides = [
      { row: 7, col: "H", value: "TRV", updatedAt: "2026-10-15T00:00:00Z" },
      { row: 6, col: "G", value: "In Progress", updatedAt: "2026-10-15T00:00:00Z" },
    ];
    const corrected = applyOverrides(original, overrides);
    expect(readCellValue(corrected, 7, "H")).toBe("TRV");
    expect(readCellValue(original, 7, "H")).toBe("");

    const fixed = parseWorkbookParts(corrected).incidents;
    expect(fixed.find((i) => i.serialNo === 3)!.station).toBe("TRV");
    expect(fixed.find((i) => i.serialNo === 2)!.status).toBe("In Progress");
    // Untouched fields keep their values.
    expect(fixed.map((i) => i.monthKey)).toEqual(parseWorkbookParts(original).incidents.map((i) => i.monthKey));

    // Reparse = original bytes + stored overrides again → same result (original never wipes corrections).
    const reparsed = parseWorkbookParts(applyOverrides(original, overrides)).incidents;
    expect(reparsed.map((i) => [i.station, i.status])).toEqual(fixed.map((i) => [i.station, i.status]));

    const remaining = buildDataCheck(corrected).issues.map((i) => i.cell);
    expect(remaining).not.toContain("H7");
    expect(remaining).not.toContain("G6");
  });

  it("returns the original bytes untouched when there are no overrides", () => {
    const original = makeWorkbook();
    expect(applyOverrides(original, [])).toBe(original);
  });
});