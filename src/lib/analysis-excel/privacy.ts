/**
 * PA-14: "Hide personal details" for the Analysis Excel export.
 * Pure string work (no DOM / Node APIs) so it runs in the browser, Node and Workers.
 */

export type PersonalKind = "name" | "id" | "phone";
export type PersonalColumn = { index: number; header: string; label: string; kind: PersonalKind };

/** What the switch hides, found by header text (row 4 of the incident log). */
const RULES: { label: string; kind: PersonalKind; test: (h: string) => boolean }[] = [
  { label: "Name", kind: "name", test: (h) => /^(person involved|name)$/.test(h) },
  { label: "Staff no.", kind: "id", test: (h) => /^staff\s*(no|number|id)\.?$/.test(h) },
  { label: "Contact no.", kind: "phone", test: (h) => /^(contact|phone|mobile)\s*(no|number)?\.?$/.test(h) },
  { label: "Reporting name", kind: "name", test: (h) => /^report(ing|ed by)\s*(person\s*)?name$/.test(h) },
  { label: "Injured person's name", kind: "name", test: (h) => /^injured\s*person('?s)?\s*name$/.test(h) },
];

export const HIDDEN = "Hidden";
export const HIDES_LINE = "Hides: name, staff no., contact no., reporting name, injured person's name.";

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const PLACEHOLDER = /^(n\/?a|nil|none|null|-+|\.+|na|not applicable|no|nill|0)$/i;
/**
 * Words people type in the name columns that are roles or statuses, not names. They are still
 * hidden in the name columns, but not removed from free text (that would break e.g. Status).
 */
export const NOT_A_NAME = /^(passengers?|pax|pending|unknown|staff|crew|driver|operator|supervisor|team|security|contractor|visitor|others?|multiple|all|self|nil|none)$/i;

export function findPersonalColumns(headerRow: unknown[]): PersonalColumn[] {
  const out: PersonalColumn[] = [];
  headerRow.forEach((cell, index) => {
    const h = norm(cell);
    const rule = RULES.find((r) => r.test(h));
    if (rule) out.push({ index, header: String(cell).trim(), label: rule.label, kind: rule.kind });
  });
  return out;
}

export function findHeaderRowIndex(rows: unknown[][]): number {
  const i = rows.findIndex((r) => r.some((c) => /^s\.?\s*no\.?$/i.test(String(c ?? "").trim())));
  return i >= 0 ? i : 3;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Distinct real values from the personal columns; name cells are also split into individual names. */
export function collectPersonalValues(rows: unknown[][], headerIndex: number, cols: PersonalColumn[]): string[] {
  const set = new Set<string>();
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    for (const col of cols) {
      const raw = String(row[col.index] ?? "").replace(/\s+/g, " ").trim();
      if (!raw || PLACEHOLDER.test(raw)) continue;
      if (!NOT_A_NAME.test(raw)) set.add(raw);
      if (col.kind === "name") {
        for (const part of raw.split(/\s*(?:,|;|\/|&|\band\b|\(|\))\s*/i)) {
          const p = part.trim();
          if (p && !PLACEHOLDER.test(p) && !NOT_A_NAME.test(p)) set.add(p);
        }
      }
    }
  }
  // longest first so "Arun Kaladan" is replaced before "Arun"; very short tokens are too ambiguous
  return [...set].filter((v) => v.replace(/[^A-Za-z0-9]/g, "").length >= 3).sort((a, b) => b.length - a.length);
}

/** A digit run of 8 or more digits, allowing spaces, dots or dashes between digits, optional +. */
export const PHONE_RE = /(?<!\d|\d\.)\+?\d(?:[\s-]?\d){7,}(?!\d|\.\d)/g;

/** Dates (ISO or D-M-Y) and HHMM-HHMM time ranges are not phone numbers. */
const DATE_LIKE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.-]\d{1,2}[.-]\d{2,4}|\d{4}\s*-\s*\d{4})$/;

export function isDateOrTimeLike(s: string): boolean {
  return DATE_LIKE.test(s.trim());
}

/**
 * Staff-number-like token: 3 station/letter characters, a letter, then 3+ digits, with anything
 * appended (e.g. TSTA0104, TSTA01045, T0ST0110). Shape taken from the Staff No. column. Upper case
 * only, so ordinary words followed by digits are left alone; flight numbers (EK 533), GHR numbers
 * (COK2026/01) and ULD numbers (AKE12345EK) do not have this shape.
 */
export const STAFF_RE = /(?<![A-Za-z0-9])[A-Z][A-Z0-9]{2}[A-Z]\d{3,}[A-Za-z0-9]*(?![A-Za-z0-9])/g;

/** Words never treated as name tokens (roles, departments, common words). Station, type and status words are added per sheet. */
const COMMON_WORDS = new Set(
  (
    "the and for with from was were has had his her him she they them our are not but all any per near bay belt gate " +
    "staff crew driver operator supervisor agent hand utility loader manager duty officer executive security technician " +
    "team lead leader ramp gsd gse pax nsop bfs mr mrs ms sir madam miss shri smt passenger passengers pending unknown " +
    "others other multiple self nil none closed open progress area apron terminal aircraft vehicle equipment " +
    "operators opt coordinator incharge in-charge shift on at by to of in when while during after before then also " +
    "monday tuesday wednesday thursday friday saturday sunday today yesterday"
  ).split(/\s+/),
);

export type RedactorInput = {
  /** exact values from the personal columns (full cells and split names) */
  values: string[];
  /** single name tokens (3+ letters) from the name columns */
  nameTokens?: string[];
  /** staff numbers from the Staff No. column (any token starting with one is hidden) */
  staffIds?: string[];
  /** words that must never be swallowed into a name (station codes, type/status words) */
  keepWords?: Set<string>;
};

function wordRe(v: string, flags = "gi"): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRe(v).replace(/\\? /g, "\\s+")}(?![A-Za-z0-9])`, flags);
}

/** Following capitalised words or initials ("Kumar", "K.T", "K.") — the rest of a full name. */
const NAME_EXT = /(?:\s+|\s*\.\s*)(?:[A-Z][a-z][A-Za-z'’-]*|[A-Z](?:\.[A-Z])*\.?)(?![A-Za-z0-9])/y;
/** In ALL-CAPS text ("RAVI VARMA DESAI") the rest of the name is all caps too. */
const NAME_EXT_CAPS = /(?:\s+|\s*\.\s*)(?:[A-Z]{2,}|[A-Z](?:\.[A-Z])*\.?)(?![A-Za-z0-9])/y;

function maskNameRuns(text: string, tokenRe: RegExp | null, keep: Set<string>): string {
  if (!tokenRe) return text;
  let out = "";
  let last = 0;
  tokenRe.lastIndex = 0;
  for (let m = tokenRe.exec(text); m; m = tokenRe.exec(text)) {
    let end = m.index + m[0].length;
    const ext = m[0].length > 1 && m[0] === m[0].toUpperCase() ? NAME_EXT_CAPS : NAME_EXT;
    ext.lastIndex = end;
    for (let e = ext.exec(text); e; e = ext.exec(text)) {
      const word = e[0].replace(/^[\s.]+/, "").replace(/\.$/, "");
      if (word !== HIDDEN && (COMMON_WORDS.has(word.toLowerCase()) || keep.has(word.toLowerCase()))) break;
      end = ext.lastIndex;
    }
    // and the capitalised words or initials just before it ("Manoj K", "RK", "Raghuveer")
    let start = m.index;
    for (;;) {
      const prev = /(?:^|[^A-Za-z])([A-Z][a-z][A-Za-z'’-]*|[A-Z]{1,2})\.?\s*$/.exec(text.slice(last, start));
      if (!prev || !/\s|\./.test(text.slice(last, start).slice(-1))) break;
      const w = prev[1]!;
      if (COMMON_WORDS.has(w.toLowerCase()) || keep.has(w.toLowerCase())) break;
      start = last + prev.index + prev[0].length - prev[0].replace(/^[^A-Za-z]/, "").length;
    }
    out += `${text.slice(last, start)}${HIDDEN}`;
    last = end;
    tokenRe.lastIndex = end;
  }
  return out + text.slice(last);
}

export function makeRedactor(input: RedactorInput | string[]): (text: string) => string {
  const opts: RedactorInput = Array.isArray(input) ? { values: input } : input;
  const pats = opts.values.map((v) => wordRe(v));
  const staffPrefix = (opts.staffIds ?? [])
    .filter((v) => v.replace(/[^A-Za-z0-9]/g, "").length >= 5)
    .map((v) => new RegExp(`(?<![A-Za-z0-9])${escapeRe(v).replace(/\\? /g, "\\s?")}[A-Za-z0-9]*`, "gi"));
  const toks = [...new Set((opts.nameTokens ?? []).map((t) => t.toLowerCase()))].sort((a, b) => b.length - a.length);
  const tokenRe = toks.length ? new RegExp(`(?<![A-Za-z])(?:${toks.map(escapeRe).join("|")})(?![A-Za-z])`, "gi") : null;
  return (text: string) => {
    // name runs first, so a known short name still pulls in the rest of the full name
    let t = maskNameRuns(text, tokenRe, opts.keepWords ?? new Set());
    for (const p of pats) t = t.replace(p, HIDDEN);
    for (const p of staffPrefix) t = t.replace(p, HIDDEN);
    t = t.replace(STAFF_RE, HIDDEN);
    t = t.replace(PHONE_RE, (m) => (DATE_LIKE.test(m) ? m : HIDDEN));
    // any hidden value also takes the neighbouring capitalised name words with it
    t = maskNameRuns(t, /(?<![A-Za-z])Hidden(?![A-Za-z])/g, opts.keepWords ?? new Set());
    return t.replace(/Hidden(?:[\s.]+Hidden)+/g, HIDDEN);
  };
}

/** Name tokens (3+ letters) from the name columns, minus station codes, type/status/department words and role words. */
export function collectNameTokens(rows: unknown[][], headerIndex: number, cols: PersonalColumn[], excluded: Set<string>): string[] {
  const set = new Set<string>();
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    for (const col of cols.filter((c) => c.kind === "name")) {
      const raw = String(rows[r]?.[col.index] ?? "");
      for (const tok of raw.split(/[^A-Za-z]+/)) {
        const low = tok.toLowerCase();
        if (tok.length < 3 || PLACEHOLDER.test(tok) || NOT_A_NAME.test(tok) || COMMON_WORDS.has(low) || excluded.has(low)) continue;
        set.add(tok);
      }
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

export function collectStaffIds(rows: unknown[][], headerIndex: number, cols: PersonalColumn[]): string[] {
  const set = new Set<string>();
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    for (const col of cols.filter((c) => c.kind === "id")) {
      for (const part of String(rows[r]?.[col.index] ?? "").split(/[,;/&]+/)) {
        const p = part.trim();
        if (p.replace(/[^A-Za-z0-9]/g, "").length >= 5 && /\d/.test(p) && !PLACEHOLDER.test(p)) set.add(p);
      }
    }
  }
  return [...set];
}

const STATION_WORDS = ["blr", "cjb", "cok", "del", "goi", "hyd", "imf", "ixa", "ixc", "maa", "trv", "trz", "bom", "ccu", "pnq", "amd"];

const PROTECTED =
  /^(s\.?\s*no\.?|ghr no\.?|date of incident|reporting date|time of incident|department involved|operational phase|incident type|incident category|status|station|weather|surface condition|lighting|investigation date|action date|a\/c type|a\/c registration|flight no\.?|ata \(lt\)|atd \(lt\))$/;

export type MaskResult = {
  rows: unknown[][];
  columns: PersonalColumn[];
  /** every original value that was hidden (for audits/tests) */
  hiddenValues: string[];
  nameTokens: string[];
  staffIds: string[];
};

/** Mask the uploaded matrix: personal cells become "Hidden"; free text loses those names and phone-like numbers. */
export function maskPersonalData(rows: unknown[][]): MaskResult {
  const headerIndex = findHeaderRowIndex(rows);
  const columns = findPersonalColumns(rows[headerIndex] ?? []);
  const personalIdx = new Set(columns.map((c) => c.index));
  const header = rows[headerIndex] ?? [];
  // classification/ID columns feed the counts, so they are never rewritten
  const protectedIdx = new Set(header.map((h, i) => (PROTECTED.test(norm(h)) ? i : -1)).filter((i) => i >= 0));
  const values = collectPersonalValues(rows, headerIndex, columns);
  // words that must survive: station codes and every word used in the classification columns
  const excluded = new Set<string>();
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    for (const i of protectedIdx) {
      for (const w of String(rows[r]?.[i] ?? "").split(/[^A-Za-z]+/)) if (w.length >= 3) excluded.add(w.toLowerCase());
    }
  }
  for (const code of STATION_WORDS) excluded.add(code);
  const nameTokens = collectNameTokens(rows, headerIndex, columns, excluded);
  const staffIds = collectStaffIds(rows, headerIndex, columns);
  const redact = makeRedactor({ values, nameTokens, staffIds, keepWords: excluded });
  const out = rows.map((row, r) => {
    if (r <= headerIndex) return row;
    return (row ?? []).map((cell, c) => {
      if (personalIdx.has(c)) {
        const raw = String(cell ?? "").trim();
        return raw ? HIDDEN : cell;
      }
      if (cell == null || cell === "" || protectedIdx.has(c)) return cell;
      if (typeof cell === "number") return String(cell).replace(/\D/g, "").length >= 8 ? HIDDEN : cell;
      if (cell instanceof Date) return cell;
      return redact(String(cell));
    });
  });
  return { rows: out, columns, hiddenValues: values, nameTokens, staffIds };
}

/** Strip author names from docProps (creator / lastModifiedBy / company / manager). */
export function scrubDocProps(xml: string): string {
  return xml
    .replace(/<(dc:creator|cp:lastModifiedBy|Company|Manager)>[\s\S]*?<\/\1>/g, "<$1></$1>")
    .replace(/<(dc:creator|cp:lastModifiedBy|Company|Manager)\/>/g, "<$1></$1>");
}
