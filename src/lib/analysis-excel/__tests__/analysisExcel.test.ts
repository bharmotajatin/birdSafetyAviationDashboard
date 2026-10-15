import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { parseIncidentLog, ensureUniqueIncidentIds } from "../../parse/incidents";
import { readWorkbookMatrices } from "../../parse/utils";
import type { Incident } from "../../types";
import { buildAnalysisModel, countFormula, HELPER_COLUMNS, helperRange } from "../model";
import { fillAnalysisTemplate } from "../template";
import { acceptancesFromCheck, openUploadIssues } from "../issues";
import { collectPersonalValues, findHeaderRowIndex, findPersonalColumns, HIDDEN, isDateOrTimeLike, makeRedactor, maskPersonalData, PHONE_RE } from "../privacy";
import { prepareAnalysis } from "../prepare";
import type { DataCheckIssue } from "../../data-check";

const ROOT = path.resolve(__dirname, "../../../..");
// Local-only copy of Jatin's sheet (not committed). Tests that need it are skipped when it is absent.
const SHEET = process.env.PA12_SHEET ?? path.join(ROOT, ".local", "incident-log.xlsx");
const TEMPLATE = path.join(ROOT, "public", "templates", "Analysis_Excel_Template.xlsx");

function inc(partial: Partial<Incident>, i: number): Incident {
  return {
    id: `row-${4 + i}-X${i}`,
    serialNo: i + 1,
    title: "T",
    ghrNumber: `DEL2026/${i}`,
    date: null,
    dateLabel: "",
    category: "CAT-C",
    incidentType: "GSE Damage",
    department: "RAMP",
    status: "Closed",
    station: "DEL",
    monthKey: "2026-01",
    ...partial,
  } as unknown as Incident;
}

describe("Step 1 issues match Data Check", () => {
  const issue = (cell: string, value: string): DataCheckIssue =>
    ({ row: Number(cell.replace(/\D/g, "")), col: cell.replace(/\d/g, ""), cell, field: "category", header: "", serialNo: 0, value, problem: "" }) as DataCheckIssue;
  const issues = [issue("AG21", "NIL"), issue("AG24", "NIL"), issue("BB92", "")];
  const check = {
    acceptedIssues: [
      { acceptance: { row: 21, col: "AG", value: "NIL", acceptedAt: "", acceptedBy: "x" } },
      // accepted with a different value: the cell changed since, so it is open again
      { acceptance: { row: 24, col: "AG", value: "CAT-C", acceptedAt: "", acceptedBy: "x" } },
    ],
  };
  it("leaves out issues accepted on Data Check with the same cell and value", () => {
    expect(openUploadIssues(issues, acceptancesFromCheck(check)).map((i) => i.cell)).toEqual(["AG24", "BB92"]);
  });
  it("keeps every issue when nothing is accepted", () => {
    expect(openUploadIssues(issues, acceptancesFromCheck({ acceptedIssues: [] }))).toHaveLength(3);
    expect(openUploadIssues(issues, acceptancesFromCheck(null))).toHaveLength(3);
  });
});

describe("analysis excel model (synthetic)", () => {
  const incidents = [
    inc({ incidentType: "GSE Damage; Collision/Impact", department: "RAMP; GSD" }, 0),
    inc({ incidentType: "GSE DAMAGE", status: "Pending", category: "CAT-A" }, 1),
    inc({ incidentType: "NONE", department: "", station: "" as Incident["station"], monthKey: "2026-03" }, 2),
  ];
  const model = buildAnalysisModel(incidents);

  it("counts split types and departments with the app's split logic", () => {
    expect(model.checks).toMatchObject({ incidents: 3, typeEntries: 4, deptEntries: 4, notClosed: 1, serious: 1 });
    expect(model.types.map((t) => [t.label, t.value])).toEqual([
      ["GSE Damage", 2],
      ["Collision/Impact", 1],
      ["Not set", 1],
    ]);
    expect(model.departments[model.departments.length - 1]!.label).toBe("Not set");
  });

  it("months are continuous with no future padding", () => {
    expect(model.months.map((m) => [m.monthKey, m.value])).toEqual([
      ["2026-01", 2],
      ["2026-02", 0],
      ["2026-03", 1],
    ]);
  });

  it("formulas point at the hidden helper columns, without wildcards", () => {
    const type = model.sheets.find((s) => s.name === "Type")!;
    const f = type.rows[1]![1]!.f!;
    expect(f).toBe(`COUNTIFS(Log!$BG$5:$BG$1000,A5)+COUNTIFS(Log!$BH$5:$BH$1000,A5)`);
    const dept = model.sheets.find((s) => s.name === "Department")!;
    expect(dept.rows[1]![1]!.f).toBe(countFormula(["dept1", "dept2"], "A5"));
    expect(dept.rows[1]![1]!.f).toContain("$BI$5:$BI$1000");
    expect(dept.rows[1]![1]!.f).toContain("$BJ$5:$BJ$1000");
    for (const s of model.sheets) for (const r of s.rows) for (const c of r) expect(c.f ?? "").not.toMatch(/\*/);
    expect(helperRange("month")).toBe(`Log!$${HELPER_COLUMNS.month}$5:$${HELPER_COLUMNS.month}$1000`);
  });

  it("links go back to Log rows", () => {
    const nc = model.sheets.find((s) => s.name === "Not closed")!;
    expect(nc.rows[1]![6]!.link).toBe("#Log!A6");
    expect(nc.rows[1]![6]!.f).toBe('HYPERLINK("#Log!A6","Open in log")');
  });
});

const haveSheet = fs.existsSync(SHEET);
(haveSheet ? describe : describe.skip)("analysis excel on Jatin's sheet", () => {
  const buf = haveSheet ? fs.readFileSync(SHEET) : Buffer.alloc(0);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const sheets = haveSheet ? readWorkbookMatrices(ab) : [];
  const incidents = haveSheet ? ensureUniqueIncidentIds(parseIncidentLog(sheets)) : [];
  const model = buildAnalysisModel(incidents);

  it("has 96 incidents, 97 type entries and 98 department entries", () => {
    expect(model.checks.incidents).toBe(96);
    expect(model.checks.typeEntries).toBe(97);
    expect(model.checks.deptEntries).toBe(98);
    expect(model.months.map((m) => m.value)).toEqual([15, 13, 4, 14, 14, 9, 13, 11, 3]);
    // BLR2026/27 and BLR2026/32 have an empty station cell: station comes from the GHR prefix.
    expect(model.stations.map((s) => s.label)).toEqual(["DEL", "TRV", "BLR", "COK", "MAA", "HYD"]);
    expect(model.stations.find((s) => s.label === "BLR")?.value).toBe(31);
    expect(incidents.filter((i) => i.stationFromGhr).map((i) => i.ghrNumber).sort()).toEqual(["BLR2026/27", "BLR2026/32"]);
    expect(model.sheets.find((s) => s.name === "Station")!.rows.slice(1, 7).map((r) => r[0]!.v)).toEqual(["DEL", "TRV", "BLR", "COK", "MAA", "HYD"]);
  });

  (fs.existsSync(TEMPLATE) ? it : it.skip)("fills the template, keeps charts and rebuilds Type/Department", async () => {
    const out = await fillAnalysisTemplate(fs.readFileSync(TEMPLATE), { model, sourceRows: sheets[0]!.rows });
    const zip = await JSZip.loadAsync(out);
    const charts = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f));
    expect(charts.length).toBe(6);
    const wb = XLSX.read(out, { type: "array", cellFormula: true });
    expect(wb.SheetNames).toEqual(expect.arrayContaining(["Dashboard", "Log", "Type", "Department", "Monthly", "Not closed"]));
    const log = wb.Sheets.Log!;
    expect(log.A100?.v).toBe(96);
    expect(log.A101).toBeUndefined();
    const type = wb.Sheets.Type!;
    expect(type.A5?.v).toBe("GSE Damage");
    expect(type.B5?.f).toBe("COUNTIFS(Log!$BG$5:$BG$1000,A5)+COUNTIFS(Log!$BH$5:$BH$1000,A5)");
    const typeTotalRow = 5 + model.types.length;
    expect(type[`A${typeTotalRow}`]?.v).toBe("Total");
    expect(type[`B${typeTotalRow}`]?.v).toBe(97);
    expect(type[`A${typeTotalRow - 1}`]?.v).toBe("Not set");
    const dept = wb.Sheets.Department!;
    expect(dept[`B${5 + model.departments.length}`]?.v).toBe(98);
    const chartXml = await Promise.all(charts.map((c) => zip.file(c)!.async("string")));
    expect(chartXml.join("")).toContain(`'Type'!$B$5:$B$${typeTotalRow - 1}`);
    const station = wb.Sheets.Station!;
    expect(["A5", "A6", "A7", "A8", "A9", "A10"].map((a) => station[a]?.v)).toEqual(["DEL", "TRV", "BLR", "COK", "MAA", "HYD"]);
    expect(station.B7?.v).toBe(31);
    expect(station.B11?.v).toBe(96);
    expect(station.B5?.v).toBe(23);
    expect(station.A11?.v).toBe("Total");
    expect(chartXml.join("")).toContain("'Station'!$B$5:$B$10");
  });
});

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

(haveSheet && fs.existsSync(TEMPLATE) ? describe : describe.skip)("hide personal details", () => {
  it("no original name, staff no. or phone number appears in any part of the xlsx", async () => {
    const buf = fs.readFileSync(SHEET);
    const sheets = readWorkbookMatrices(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const sheet = sheets[0]!;
    const hi = findHeaderRowIndex(sheet.rows);
    const cols = findPersonalColumns(sheet.rows[hi]!);
    expect(cols.map((c) => c.label).sort()).toEqual(["Contact no.", "Injured person's name", "Name", "Reporting name", "Staff no."].sort());
    const masked = maskPersonalData(sheet.rows);
    const values = [...new Set([...collectPersonalValues(sheet.rows, hi, cols), ...masked.nameTokens, ...masked.staffIds])];
    expect(values.length).toBeGreaterThan(50);
    expect(masked.nameTokens.length).toBeGreaterThan(20);

    const p = prepareAnalysis(sheet, true);
    expect(p.model.checks).toMatchObject({ incidents: 96, typeEntries: 97, deptEntries: 98 });
    const out = await fillAnalysisTemplate(fs.readFileSync(TEMPLATE), { model: p.model, sourceRows: p.sourceRows, hidePersonal: true });
    const zip = await JSZip.loadAsync(out);
    const parts = await Promise.all(
      Object.keys(zip.files)
        .filter((f) => !zip.files[f]!.dir)
        .map(async (f) => [f, decodeXml(await zip.file(f)!.async("string"))] as const),
    );
    const leaks: string[] = [];
    for (const v of values) {
      const re = new RegExp(`(?<![A-Za-z0-9])${reEsc(v).replace(/\\? /g, "\\s+")}(?![A-Za-z0-9])`, "i");
      for (const [f, x] of parts) if (re.test(x)) leaks.push(`"${v}" in ${f}`);
    }
    for (const [f, x] of parts.filter(([f]) => f.startsWith("xl/worksheets/"))) {
      for (const m of x.matchAll(/(?<![A-Za-z0-9])[A-Z][A-Z0-9]{2}[A-Z]\d{3,}[A-Za-z0-9]*/g)) leaks.push(`staff-like ${m[0]} in ${f}`);
      for (const m of x.matchAll(PHONE_RE)) {
        if (!isDateOrTimeLike(m[0])) leaks.push(`number ${m[0]} in ${f}`);
      }
    }
    expect(leaks).toEqual([]);

    const core = parts.find(([f]) => f === "docProps/core.xml")?.[1] ?? "";
    expect(core).not.toMatch(/<dc:creator>[^<]+</);
    expect(core).not.toMatch(/<cp:lastModifiedBy>[^<]+</);

    const wb = XLSX.read(out, { type: "array" });
    const log = wb.Sheets.Log!;
    for (const c of cols) {
      const col = XLSX.utils.encode_col(c.index);
      expect(log[`${col}5`]?.v ?? HIDDEN).toBe(HIDDEN);
    }
    const preview = p.model.sheets.find((s) => s.name === "Log")!;
    expect(preview.rows[1]!.filter((x) => x.kind === "hidden").length).toBeGreaterThan(0);
  });
});

describe("masking leak shapes (synthetic)", () => {
  const header = ["S.No.", "Incident Title", "GHR No.", "Date of Incident", "Person Involved", "Staff No.", "Contact No.", "Reporting Name", "Incident Brief", "Incident Type", "Status", "Station"];
  const rows: unknown[][] = [
    [],
    [],
    [],
    header,
    ["1", "EQUIPMENT DAMAGE", "BLR2026/01", "2026-01-17", "Arjun", "TSTA0104", "9000000001", "Leela P.R", "Driver Arjun Mehra Rao hit the dolly at Bay 22 while staff TSTA01045 watched. Reported by Leela P.R and TSTX12345; call 90000 12345. GSE Damage at BLR, Closed.", "GSE Damage", "Closed", "BLR"],
    ["2", "NEAR MISS", "DEL2026/02", "2026-02-03", "Ravi Varma", "TSTP0310", "", "", "Mr. RAVI VARMA DESAI reported the near miss; flight EK 533, ULD AKE12345EK, GHR DEL2026/02.", "Near Miss", "In Progress", "DEL"],
  ];
  const out = maskPersonalData(rows).rows;
  const brief1 = String(out[4]![8]);
  const brief2 = String(out[5]![8]);

  it("hides the full name when the name column holds a shorter form", () => {
    for (const w of ["Arjun", "Mehra", "Rao", "Leela", "RAVI", "DESAI"]) {
      expect(`${brief1} ${brief2}`).not.toMatch(new RegExp(`\\b${w}\\b`, "i"));
    }
  });

  it("hides staff numbers with extra digits and any staff-number-like token", () => {
    expect(brief1).not.toContain("TSTA0104");
    expect(brief1).not.toContain("TSTX12345");
    expect(brief1).not.toMatch(/90000/);
  });

  it("keeps station codes, type and status words, flight, ULD and GHR numbers", () => {
    expect(brief1).toContain("GSE Damage at BLR, Closed.");
    expect(brief1).toContain("Bay 22");
    expect(brief1).toMatch(/^Driver Hidden hit the dolly/);
    expect(brief2).toContain("EK 533");
    expect(brief2).toContain("AKE12345EK");
    expect(brief2).toContain("DEL2026/02");
    expect(out[5]![10]).toBe("In Progress");
    expect(out[4]![4]).toBe(HIDDEN);
  });
});

describe("masking leak shapes (synthetic, name before the known part)", () => {
  it("hides first names and initials before a known surname", () => {
    const redact = makeRedactor({ values: [], nameTokens: ["Kumar"], keepWords: new Set(["blr"]) });
    expect(redact("Manoj Kumar reported; RK Kumar issued; Driver Raghuveer Kumar left at BLR Kumar")).toBe("Hidden reported; Hidden issued; Driver Hidden left at BLR Hidden");
  });
});
