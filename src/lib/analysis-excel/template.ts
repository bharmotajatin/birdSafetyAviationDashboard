import JSZip from "jszip";
import {
  HELPER_COLUMNS,
  LOG_FIRST_ROW,
  countFormula,
  firstRowLinkFormula,
  type AnalysisModel,
  type BreakdownItem,
  type HelperKey,
} from "./model";
import { maskPersonalData, scrubDocProps } from "./privacy";

/**
 * PA-12 Step 3: fill DESIGNER's Analysis Excel template by editing the xlsx XML directly
 * (SheetJS community edition drops charts). Uses only JSZip + string work, so it runs in the
 * browser, Node and Cloudflare Workers alike.
 */

export function colToNum(col: string): number {
  return col.split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}
export function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // strip characters that are illegal in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

type CellValue = string | number | null | undefined;

function cellXml(ref: string, value: CellValue, style?: string, formula?: string): string {
  const s = style ? ` s="${style}"` : "";
  if (formula) {
    if (typeof value === "number") return `<c r="${ref}"${s}><f>${esc(formula)}</f><v>${value}</v></c>`;
    return `<c r="${ref}"${s} t="str"><f>${esc(formula)}</f><v>${esc(String(value ?? ""))}</v></c>`;
  }
  if (value === null || value === undefined || value === "") return style ? `<c r="${ref}"${s}/>` : "";
  if (typeof value === "number") return `<c r="${ref}"${s} t="n"><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

/** Excel serial for a local calendar date (1900 date system). */
export function excelSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}
function isoToSerial(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  return m ? excelSerial(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

const ROW_RE = /<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;

function rowsOf(xml: string): { r: number; xml: string }[] {
  const data = /<sheetData>([\s\S]*?)<\/sheetData>|<sheetData\/>/.exec(xml);
  if (!data || !data[1]) return [];
  return [...data[1].matchAll(ROW_RE)].map((m) => ({ r: Number(m[1]), xml: m[0] }));
}

/** column letter -> style id for one template row */
function stylesOfRow(rowXml: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!rowXml) return out;
  for (const m of rowXml.matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*?\bs="(\d+)")?/g)) {
    if (m[2]) out.set(m[1]!, m[2]);
  }
  return out;
}

function replaceSheetData(xml: string, keepBefore: number, newRows: string[], lastCol: string): string {
  const kept = rowsOf(xml).filter((r) => r.r < keepBefore).map((r) => r.xml);
  const body = `<sheetData>${kept.join("")}${newRows.join("")}</sheetData>`;
  const lastRow = Math.max(keepBefore - 1, keepBefore - 1 + newRows.length);
  return xml
    .replace(/<sheetData>[\s\S]*?<\/sheetData>|<sheetData\/>/, body)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastCol}${lastRow}"/>`)
    .replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, "");
}

function row(r: number, cells: string[], attrs = ""): string {
  return `<row r="${r}"${attrs}>${cells.join("")}</row>`;
}

async function sheetPaths(zip: JSZip): Promise<Map<string, string>> {
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const t = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) target.set(id, t.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const out = new Map<string, string>();
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /name="([^"]+)"/.exec(m[0])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    if (name && rid && target.get(rid)) out.set(name, `xl/${target.get(rid)}`);
  }
  return out;
}

export type FillInput = {
  model: AnalysisModel;
  /** Uploaded incident-log matrix (index = Excel row - 1), as produced by readWorkbookMatrices. */
  sourceRows: unknown[][];
  /** PA-14: mask personal columns, names/phone numbers in free text, and author names in docProps. */
  hidePersonal?: boolean;
  /** Number of original log columns to copy (A..BB = 54). */
  logColumns?: number;
};

function breakdownRows(
  items: BreakdownItem[],
  keys: HelperKey[],
  styles: Map<string, string>,
  totalStyles: Map<string, string>,
  totalIncidents: number,
): string[] {
  const out: string[] = [];
  items.forEach((it, i) => {
    const r = LOG_FIRST_ROW + i;
    out.push(
      row(r, [
        cellXml(`A${r}`, it.label, styles.get("A")),
        cellXml(`B${r}`, it.value, styles.get("B"), countFormula(keys, `A${r}`)),
        cellXml(`C${r}`, totalIncidents ? it.value / totalIncidents : 0, styles.get("C"), `IFERROR(B${r}/Dashboard!$B$5,0)`),
        cellXml(`D${r}`, it.rows.length ? "Open in log" : "", styles.get("D"), firstRowLinkFormula(keys[0]!, `A${r}`)),
      ]),
    );
  });
  const t = LOG_FIRST_ROW + items.length;
  const sum = items.reduce((a, b) => a + b.value, 0);
  out.push(
    row(t, [
      cellXml(`A${t}`, "Total", totalStyles.get("A")),
      cellXml(`B${t}`, sum, totalStyles.get("B"), `SUM(B${LOG_FIRST_ROW}:B${t - 1})`),
    ]),
  );
  return out;
}

function updateChartRanges(xml: string, ends: Record<string, number>): string {
  return xml.replace(/'?(Station|Category|Type|Department|Monthly)'?!\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)/g, (all, sheet: string, c1: string, r1: string, c2: string) => {
    const end = ends[sheet];
    if (!end || Number(r1) !== LOG_FIRST_ROW) return all;
    return `'${sheet}'!$${c1}$${r1}:$${c2}$${end}`;
  });
}

function notClosedSheetXml(model: AnalysisModel): string {
  const hdr = ["S.No.", "GHR No.", "Incident Title", "Station", "Status", "Category", "Link"];
  const rows: string[] = [
    row(1, [cellXml("A1", "Incidents not closed")]),
    row(2, [cellXml("A2", "Every incident whose status is not Closed. Click Open in log to jump to the row.")]),
    row(4, hdr.map((h, i) => cellXml(`${numToCol(i + 1)}4`, h))),
  ];
  model.notClosed.forEach((h, i) => {
    const r = LOG_FIRST_ROW + i;
    rows.push(
      row(r, [
        cellXml(`A${r}`, h.serialNo),
        cellXml(`B${r}`, h.ghr),
        cellXml(`C${r}`, h.title),
        cellXml(`D${r}`, h.station),
        cellXml(`E${r}`, h.rawStatus || "Not set"),
        cellXml(`F${r}`, h.category),
        cellXml(`G${r}`, "Open in log", undefined, `HYPERLINK("#Log!A${h.logRow}","Open in log")`),
      ]),
    );
  });
  const last = LOG_FIRST_ROW + model.notClosed.length - 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:G${Math.max(4, last)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="40" customWidth="1"/><col min="4" max="6" width="12" customWidth="1"/><col min="7" max="7" width="14" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/></worksheet>`;
}

async function addNotClosedSheet(zip: JSZip, model: AnalysisModel, paths: Map<string, string>): Promise<void> {
  if (paths.has("Not closed")) {
    zip.file(paths.get("Not closed")!, notClosedSheetXml(model));
    return;
  }
  let n = 1;
  while (zip.file(`xl/worksheets/sheet${n}.xml`)) n += 1;
  const part = `worksheets/sheet${n}.xml`;
  zip.file(`xl/${part}`, notClosedSheetXml(model));
  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  const rid = `rIdNotClosed${n}`;
  rels = rels.replace(
    "</Relationships>",
    `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/${part}"/></Relationships>`,
  );
  zip.file(relsPath, rels);
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  const ids = [...wb.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1]));
  const sheetId = Math.max(0, ...ids) + 1;
  const tag = `<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="Not closed" sheetId="${sheetId}" state="visible" r:id="${rid}"/>`;
  // place it just before the Log sheet if possible, otherwise at the end
  wb = /<sheet\b[^>]*name="Log"[^>]*\/>/.test(wb)
    ? wb.replace("</sheets>", `${tag}</sheets>`)
    : wb.replace("</sheets>", `${tag}</sheets>`);
  zip.file("xl/workbook.xml", wb);
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  ct = ct.replace(
    "</Types>",
    `<Override PartName="/xl/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  zip.file("[Content_Types].xml", ct);
}

export async function fillAnalysisTemplate(template: ArrayBuffer | Uint8Array, input: FillInput): Promise<Uint8Array> {
  const { model } = input;
  // Masking is idempotent, so re-applying it here guarantees nothing personal reaches the Log.
  const sourceRows = input.hidePersonal ? maskPersonalData(input.sourceRows).rows : input.sourceRows;
  const logColumns = input.logColumns ?? 54;
  const zip = await JSZip.loadAsync(template);
  const paths = await sheetPaths(zip);
  const read = async (name: string) => {
    const p = paths.get(name);
    if (!p || !zip.file(p)) throw new Error(`Template is missing the ${name} sheet`);
    return { path: p, xml: await zip.file(p)!.async("string") };
  };

  // ---- Log: original columns + hidden helpers
  {
    const { path, xml } = await read("Log");
    const tplRows = rowsOf(xml);
    const styles = stylesOfRow(tplRows.find((r) => r.r === LOG_FIRST_ROW)?.xml);
    const helperCols = Object.entries(HELPER_COLUMNS) as [HelperKey, string][];
    const lastCol = helperCols[helperCols.length - 1]![1];
    const rows = model.helpers.map((h) => {
      const src = (h.sourceRow ? sourceRows[h.sourceRow - 1] : undefined) ?? [];
      const cells: string[] = [];
      for (let c = 1; c <= logColumns; c += 1) {
        const col = numToCol(c);
        let v: CellValue = src[c - 1] == null ? "" : String(src[c - 1]).trim();
        if (c === 1) v = h.logRow - LOG_FIRST_ROW + 1;
        else if (c === logColumns) v = h.station === "Unknown" ? "" : h.station;
        else if (typeof v === "string" && (c === 4 || c === 5)) v = isoToSerial(v) ?? v;
        else if (typeof v === "string" && v.startsWith("=")) v = "";
        cells.push(cellXml(`${col}${h.logRow}`, v, styles.get(col)));
      }
      const hv: Record<HelperKey, CellValue> = {
        station: h.station,
        category: h.category,
        status: h.status,
        type1: h.type1,
        type2: h.type2,
        dept1: h.dept1,
        dept2: h.dept2,
        month: h.monthKey ? excelSerial(Number(h.monthKey.slice(0, 4)), Number(h.monthKey.slice(5, 7)), 1) : "",
      };
      for (const [k, col] of helperCols) cells.push(cellXml(`${col}${h.logRow}`, hv[k], styles.get(col)));
      return row(h.logRow, cells);
    });
    zip.file(path, replaceSheetData(xml, LOG_FIRST_ROW, rows, lastCol));
  }

  // ---- breakdown sheets
  const total = model.checks.incidents;
  const ends: Record<string, number> = {};
  const breakdowns: [string, BreakdownItem[], HelperKey[]][] = [
    ["Station", model.stations, ["station"]],
    ["Category", model.categories, ["category"]],
    ["Type", model.types, ["type1", "type2"]],
    ["Department", model.departments, ["dept1", "dept2"]],
  ];
  for (const [name, items, keys] of breakdowns) {
    if (!paths.has(name)) continue;
    const { path, xml } = await read(name);
    const tplRows = rowsOf(xml);
    const styles = stylesOfRow(tplRows.find((r) => r.r === LOG_FIRST_ROW)?.xml);
    const totalRow = tplRows.find((r) => /<t[^>]*>Total<\/t>/.test(r.xml))?.xml;
    zip.file(path, replaceSheetData(xml, LOG_FIRST_ROW, breakdownRows(items, keys, styles, stylesOfRow(totalRow), total), "D"));
    ends[name] = LOG_FIRST_ROW + items.length - 1;
  }

  // ---- monthly
  if (paths.has("Monthly")) {
    const { path, xml } = await read("Monthly");
    const styles = stylesOfRow(rowsOf(xml).find((r) => r.r === LOG_FIRST_ROW)?.xml);
    const rows = model.months.map((m, i) => {
      const r = LOG_FIRST_ROW + i;
      const serial = excelSerial(Number(m.monthKey.slice(0, 4)), Number(m.monthKey.slice(5, 7)), 1);
      return row(r, [cellXml(`A${r}`, serial, styles.get("A")), cellXml(`B${r}`, m.value, styles.get("B"), countFormula(["month"], `A${r}`))]);
    });
    zip.file(path, replaceSheetData(xml, LOG_FIRST_ROW, rows, "B"));
    ends.Monthly = LOG_FIRST_ROW + model.months.length - 1;
  }

  // ---- charts keep their XML; only their source ranges follow the new list lengths
  for (const f of Object.keys(zip.files).filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p))) {
    const xml = await zip.file(f)!.async("string");
    zip.file(f, updateChartRanges(xml, ends));
  }

  await addNotClosedSheet(zip, model, paths);

  // make sure Excel recalculates every formula when the file opens
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  wb = /<calcPr\b/.test(wb)
    ? wb.replace(/<calcPr\b([^>]*?)\/>/, (m, attrs: string) => (/fullCalcOnLoad/.test(attrs) ? m : `<calcPr${attrs} fullCalcOnLoad="1"/>`))
    : wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  zip.file("xl/workbook.xml", wb);

  if (input.hidePersonal) {
    for (const p of ["docProps/core.xml", "docProps/app.xml"]) {
      const f = zip.file(p);
      if (f) zip.file(p, scrubDocProps(await f.async("string")));
    }
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
