import path from "path";
import type { Incident } from "@/lib/types";
import { applyOverrides, type CellAcceptance, type CellOverride, type HistoryEntry } from "@/lib/data-check";

const R2_KEY = "current-workbook";
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_META = path.join(LOCAL_DIR, "workbook.json");
const LOCAL_BIN = path.join(LOCAL_DIR, "current-workbook.bin");
const LOCAL_OVERRIDES = path.join(LOCAL_DIR, "overrides.json");
const LOCAL_ACCEPTANCES = path.join(LOCAL_DIR, "acceptances.json");
const LOCAL_HISTORY = path.join(LOCAL_DIR, "history.json");

/** Atomic multi-file write for the local fallback: temp files first, then rename all. */
async function writeFilesAtomic(writes: [string, string | Buffer][]): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const temps = writes.map(([target]) => `${target}.${stamp}.tmp`);
  try {
    for (let i = 0; i < writes.length; i++) await fs.writeFile(temps[i]!, writes[i]![1]);
    for (let i = 0; i < writes.length; i++) await fs.rename(temps[i]!, writes[i]![0]);
  } catch (err) {
    for (const t of temps) await fs.rm(t, { force: true });
    throw err;
  }
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  const fs = await import("fs/promises");
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function historyInsert(db: D1Like, h: HistoryEntry): D1Prepared {
  return db
    .prepare(
      "INSERT INTO data_check_history (at, action, cell, field, old_value, new_value, by_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(h.at, h.action, h.cell, h.field, h.oldValue, h.newValue, h.by);
}

function toBase64(bytes: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) bin += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(text: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(text, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

type WorkbookMeta = {
  fileName: string;
  r2Key: string;
  importedAt: string;
  rowCount: number;
};

export type StoredWorkbook = {
  workbook: WorkbookMeta | null;
  incidents: Incident[];
};

type D1Prepared = {
  bind: (...values: unknown[]) => D1Prepared;
  run: () => Promise<unknown>;
  all: <T>() => Promise<{ results?: T[] }>;
  first: <T>() => Promise<T | null>;
};

type D1Like = {
  prepare: (query: string) => D1Prepared;
  batch: (statements: D1Prepared[]) => Promise<unknown>;
};

type R2Like = {
  put: (key: string, value: ArrayBuffer | Uint8Array) => Promise<unknown>;
  get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null>;
  delete: (key: string) => Promise<unknown>;
};

type CfEnv = {
  DB?: D1Like;
  WORKBOOKS?: R2Like;
};

function isoDate(value: Date | null): string | null {
  if (!value) return null;
  const time = value.getTime();
  return Number.isNaN(time) ? null : value.toISOString();
}

function toRow(incident: Incident): unknown[] {
  return [
    incident.id,
    incident.serialNo,
    incident.title,
    incident.ghrNumber,
    isoDate(incident.date),
    incident.dateLabel,
    incident.category,
    incident.incidentType,
    incident.department,
    incident.status,
    incident.station,
    incident.brief,
    incident.rootCause,
    incident.correctiveAction,
    incident.immediateAction,
    incident.location,
    incident.time,
    incident.personInvolved,
    incident.equipment,
    incident.contributingFactor,
    incident.monthKey,
    incident.stationFromGhr ? 1 : 0,
    incident.reportDate ?? "",
    incident.shiftTiming ?? "",
    incident.staffNo ?? "",
    incident.equipmentNo ?? "",
  ];
}

type IncidentRow = {
  id: string;
  serial_no: number;
  title: string;
  ghr_number: string;
  occurred_on: string | null;
  date_label: string;
  category: Incident["category"];
  incident_type: string;
  department: string;
  status: Incident["status"];
  station: string;
  brief: string;
  root_cause: string;
  corrective_action: string;
  immediate_action: string;
  location: string;
  time_label: string;
  person_involved: string;
  equipment: string;
  contributing_factor: string;
  month_key: string;
  station_from_ghr?: number | null;
  report_date?: string | null;
  shift_timing?: string | null;
  staff_no?: string | null;
  equipment_no?: string | null;
};

function fromRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    serialNo: row.serial_no,
    title: row.title,
    ghrNumber: row.ghr_number,
    date: row.occurred_on ? new Date(row.occurred_on) : null,
    dateLabel: row.date_label,
    category: row.category,
    incidentType: row.incident_type,
    department: row.department,
    status: row.status,
    station: row.station,
    brief: row.brief,
    rootCause: row.root_cause,
    correctiveAction: row.corrective_action,
    immediateAction: row.immediate_action,
    location: row.location,
    time: row.time_label,
    personInvolved: row.person_involved,
    equipment: row.equipment,
    contributingFactor: row.contributing_factor,
    monthKey: row.month_key,
    ...(row.station_from_ghr ? { stationFromGhr: true } : {}),
    reportDate: row.report_date ?? "",
    shiftTiming: row.shift_timing ?? "",
    staffNo: row.staff_no ?? "",
    equipmentNo: row.equipment_no ?? "",
  };
}

async function cloudflareEnv(): Promise<CfEnv | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = await mod.getCloudflareContext({ async: true });
    const env = ctx.env as CfEnv;
    if (!env.DB) return null;
    return env;
  } catch {
    return null;
  }
}

const INSERT_SQL = `INSERT INTO incidents (
  id, serial_no, title, ghr_number, occurred_on, date_label, category, incident_type,
  department, status, station, brief, root_cause, corrective_action, immediate_action,
  location, time_label, person_involved, equipment, contributing_factor, month_key,
  station_from_ghr, report_date, shift_timing, staff_no, equipment_no
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * @param bytes new original file (upload) or null to keep the stored one (corrections / reparse)
 * @param overrides full override set to store (replaces existing; [] on a new upload)
 */
async function saveCloudflare(
  env: CfEnv,
  fileName: string,
  bytes: ArrayBuffer | null,
  incidents: Incident[],
  overrides: CellOverride[],
  history: HistoryEntry[] = [],
): Promise<void> {
  const db = env.DB!;
  if (bytes && env.WORKBOOKS) {
    await env.WORKBOOKS.put(R2_KEY, bytes);
  }
  const importedAt = new Date().toISOString();
  const statements: D1Prepared[] = [
    // PA-09: overrides + original file are replaced in the same transaction as the incidents.
    db.prepare("DELETE FROM workbook_overrides"),
    // A new upload (bytes) also clears "Accept as is" decisions.
    ...(bytes ? [db.prepare("DELETE FROM workbook_acceptances")] : []),
    ...history.map((h) => historyInsert(db, h)),
    ...overrides.map((o) =>
      db
        .prepare("INSERT INTO workbook_overrides (row_number, col, value, updated_at) VALUES (?, ?, ?, ?)")
        .bind(o.row, o.col, o.value, o.updatedAt),
    ),
    ...(bytes
      ? [
          db
            .prepare(
              "INSERT INTO workbook_file (id, bytes_b64) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET bytes_b64 = excluded.bytes_b64",
            )
            .bind(toBase64(bytes)),
        ]
      : []),
    db.prepare("DELETE FROM incidents"),
    db
      .prepare(
        `INSERT INTO workbook (id, file_name, r2_key, imported_at, row_count)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           file_name = excluded.file_name,
           r2_key = excluded.r2_key,
           imported_at = excluded.imported_at,
           row_count = excluded.row_count`,
      )
      .bind(fileName, R2_KEY, importedAt, incidents.length),
  ];
  for (const incident of incidents) {
    statements.push(db.prepare(INSERT_SQL).bind(...toRow(incident)));
  }
  // AU-01: D1 runs a batch as one transaction, so delete + inserts commit or roll back together.
  await db.batch(statements);
}

async function readCloudflare(env: CfEnv): Promise<StoredWorkbook> {
  const db = env.DB!;
  const workbook = await db
    .prepare(
      "SELECT file_name, r2_key, imported_at, row_count FROM workbook WHERE id = 1",
    )
    .first<{
      file_name: string;
      r2_key: string;
      imported_at: string;
      row_count: number;
    }>();
  if (!workbook) return { workbook: null, incidents: [] };
  const { results } = await db
    .prepare(
      `SELECT id, serial_no, title, ghr_number, occurred_on, date_label, category,
              incident_type, department, status, station, brief, root_cause,
              corrective_action, immediate_action, location, time_label,
              person_involved, equipment, contributing_factor, month_key, station_from_ghr,
              report_date, shift_timing, staff_no, equipment_no
       FROM incidents
       ORDER BY serial_no ASC`,
    )
    .all<IncidentRow>();
  return {
    workbook: {
      fileName: workbook.file_name,
      r2Key: workbook.r2_key,
      importedAt: workbook.imported_at,
      rowCount: workbook.row_count,
    },
    incidents: (results ?? []).map(fromRow),
  };
}

async function clearCloudflare(env: CfEnv, history: HistoryEntry[]): Promise<void> {
  const db = env.DB!;
  await db.batch([
    // History is append-only: removal adds an entry instead of deleting anything.
    ...history.map((h) => historyInsert(db, h)),
    db.prepare("DELETE FROM incidents"),
    db.prepare("DELETE FROM workbook"),
    db.prepare("DELETE FROM workbook_overrides"),
    db.prepare("DELETE FROM workbook_file"),
    db.prepare("DELETE FROM workbook_acceptances"),
  ]);
  if (env.WORKBOOKS) await env.WORKBOOKS.delete(R2_KEY);
}

async function ensureLocalDir(): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

async function saveLocal(
  fileName: string,
  bytes: ArrayBuffer | null,
  incidents: Incident[],
  overrides: CellOverride[],
  history: HistoryEntry[] = [],
): Promise<void> {
  const fs = await import("fs/promises");
  await ensureLocalDir();
  const payload: StoredWorkbook = {
    workbook: {
      fileName,
      r2Key: R2_KEY,
      importedAt: new Date().toISOString(),
      rowCount: incidents.length,
    },
    incidents,
  };
  // AU-01: write new files to temp paths, then rename over the old ones, so a failed write keeps old data.
  const stamp = `${process.pid}-${Date.now()}`;
  const writes: [string, string | Buffer][] = [
    ...(bytes ? ([[LOCAL_BIN, Buffer.from(bytes)]] as [string, Buffer][]) : []),
    [LOCAL_OVERRIDES, JSON.stringify(overrides)],
    ...(bytes ? ([[LOCAL_ACCEPTANCES, "[]"]] as [string, string][]) : []),
    ...(history.length
      ? ([[LOCAL_HISTORY, JSON.stringify([...(await readJsonFile<HistoryEntry[]>(LOCAL_HISTORY, [])), ...history])]] as [string, string][])
      : []),
    [LOCAL_META, JSON.stringify(payload)],
  ];
  const temps = writes.map(([target]) => `${target}.${stamp}.tmp`);
  try {
    for (let i = 0; i < writes.length; i++) await fs.writeFile(temps[i]!, writes[i]![1]);
    for (let i = 0; i < writes.length; i++) await fs.rename(temps[i]!, writes[i]![0]);
  } catch (err) {
    for (const t of temps) await fs.rm(t, { force: true });
    throw err;
  }
}

async function readLocal(): Promise<StoredWorkbook> {
  const fs = await import("fs/promises");
  try {
    const raw = await fs.readFile(LOCAL_META, "utf8");
    const parsed = JSON.parse(raw) as StoredWorkbook;
    return {
      workbook: parsed.workbook ?? null,
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
    };
  } catch {
    return { workbook: null, incidents: [] };
  }
}

async function clearLocal(history: HistoryEntry[]): Promise<void> {
  const fs = await import("fs/promises");
  // Keep history.json (append-only); remove everything else.
  await writeFilesAtomic([
    [LOCAL_HISTORY, JSON.stringify([...(await readJsonFile<HistoryEntry[]>(LOCAL_HISTORY, [])), ...history])],
  ]);
  for (const file of [LOCAL_META, LOCAL_BIN, LOCAL_OVERRIDES, LOCAL_ACCEPTANCES]) {
    await fs.rm(file, { force: true });
  }
}

/** New upload: replaces the original file and clears corrections/acceptances; history gets an "upload" entry. */
export async function saveWorkbook(
  fileName: string,
  bytes: ArrayBuffer,
  incidents: Incident[],
  by = "Unknown",
): Promise<StoredWorkbook["workbook"]> {
  const previous = (await readWorkbook().catch(() => null))?.workbook?.fileName ?? "";
  return persist(fileName, bytes, incidents, [], [
    {
      at: new Date().toISOString(),
      action: "upload",
      cell: "",
      field: "Workbook",
      oldValue: previous,
      newValue: `${fileName} (${incidents.length} incidents)`,
      by,
    },
  ]);
}

/** PA-09: store a new full override set with the incidents re-derived from it (original file untouched). */
export async function saveCorrections(
  fileName: string,
  incidents: Incident[],
  overrides: CellOverride[],
  history: HistoryEntry[] = [],
): Promise<StoredWorkbook["workbook"]> {
  return persist(fileName, null, incidents, overrides, history);
}

async function persist(
  fileName: string,
  bytes: ArrayBuffer | null,
  incidents: Incident[],
  overrides: CellOverride[],
  history: HistoryEntry[] = [],
): Promise<StoredWorkbook["workbook"]> {
  const env = await cloudflareEnv();
  if (env) {
    await saveCloudflare(env, fileName, bytes, incidents, overrides, history);
  } else {
    await saveLocal(fileName, bytes, incidents, overrides, history);
  }
  return {
    fileName,
    r2Key: R2_KEY,
    importedAt: new Date().toISOString(),
    rowCount: incidents.length,
  };
}

/** Original uploaded bytes, if they were kept (local .data or R2 `WORKBOOKS`). */
async function readStoredBytes(env: CfEnv | null): Promise<ArrayBuffer | null> {
  if (env) {
    if (env.WORKBOOKS) {
      const obj = await env.WORKBOOKS.get(R2_KEY);
      if (obj) return await obj.arrayBuffer();
    }
    const row = await env.DB!.prepare("SELECT bytes_b64 FROM workbook_file WHERE id = 1").first<{ bytes_b64: string }>();
    return row ? fromBase64(row.bytes_b64) : null;
  }
  const fs = await import("fs/promises");
  try {
    const buf = await fs.readFile(LOCAL_BIN);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/**
 * AU-02: re-derive stored incidents from the original sheet with the current parser.
 * Returns null when the original file was not kept (e.g. no R2 binding) — re-upload is needed then.
 */
export async function reparseStoredWorkbook(
  parse: (bytes: ArrayBuffer) => Incident[],
): Promise<StoredWorkbook["workbook"] | null> {
  const original = await readOriginalWorkbook();
  if (!original) return null;
  // PA-09: corrections are re-applied, so the original file never wipes them.
  const incidents = parse(applyOverrides(original.bytes, original.overrides));
  return saveCorrections(original.fileName, incidents, original.overrides);
}

async function readOverridesFor(env: CfEnv | null): Promise<CellOverride[]> {
  if (env) {
    const { results } = await env.DB!.prepare(
      "SELECT row_number, col, value, updated_at FROM workbook_overrides ORDER BY row_number, col",
    ).all<{ row_number: number; col: string; value: string; updated_at: string }>();
    return (results ?? []).map((r) => ({ row: r.row_number, col: r.col, value: r.value, updatedAt: r.updated_at }));
  }
  const fs = await import("fs/promises");
  try {
    const parsed = JSON.parse(await fs.readFile(LOCAL_OVERRIDES, "utf8")) as CellOverride[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Original uploaded bytes + stored corrections, or null if nothing (or no original file) is stored. */
/** PA-09b: acceptances (replace all) + history rows written in one transaction / atomic file write. */
export async function saveAcceptances(acceptances: CellAcceptance[], history: HistoryEntry[]): Promise<void> {
  const env = await cloudflareEnv();
  if (env) {
    const db = env.DB!;
    await db.batch([
      db.prepare("DELETE FROM workbook_acceptances"),
      ...acceptances.map((a) =>
        db
          .prepare(
            "INSERT INTO workbook_acceptances (row_number, col, value, accepted_at, accepted_by) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(a.row, a.col, a.value, a.acceptedAt, a.acceptedBy),
      ),
      ...history.map((h) => historyInsert(db, h)),
    ]);
    return;
  }
  await writeFilesAtomic([
    [LOCAL_ACCEPTANCES, JSON.stringify(acceptances)],
    [LOCAL_HISTORY, JSON.stringify([...(await readJsonFile<HistoryEntry[]>(LOCAL_HISTORY, [])), ...history])],
  ]);
}

export async function readAcceptances(): Promise<CellAcceptance[]> {
  const env = await cloudflareEnv();
  if (env) {
    const { results } = await env.DB!.prepare(
      "SELECT row_number, col, value, accepted_at, accepted_by FROM workbook_acceptances ORDER BY row_number, col",
    ).all<{ row_number: number; col: string; value: string; accepted_at: string; accepted_by: string }>();
    return (results ?? []).map((r) => ({
      row: r.row_number,
      col: r.col,
      value: r.value,
      acceptedAt: r.accepted_at,
      acceptedBy: r.accepted_by,
    }));
  }
  return readJsonFile<CellAcceptance[]>(LOCAL_ACCEPTANCES, []);
}

/** Newest first. */
export async function readHistory(limit = 500): Promise<HistoryEntry[]> {
  const env = await cloudflareEnv();
  if (env) {
    const { results } = await env.DB!.prepare(
      "SELECT at, action, cell, field, old_value, new_value, by_name FROM data_check_history ORDER BY at DESC, id DESC LIMIT ?",
    )
      .bind(limit)
      .all<{ at: string; action: HistoryEntry["action"]; cell: string; field: string; old_value: string; new_value: string; by_name: string }>();
    return (results ?? []).map((r) => ({
      at: r.at,
      action: r.action,
      cell: r.cell,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      by: r.by_name,
    }));
  }
  const all = await readJsonFile<HistoryEntry[]>(LOCAL_HISTORY, []);
  return all.slice().reverse().slice(0, limit);
}


export async function readOriginalWorkbook(): Promise<{
  fileName: string;
  bytes: ArrayBuffer;
  overrides: CellOverride[];
} | null> {
  const env = await cloudflareEnv();
  const current = env ? await readCloudflare(env) : await readLocal();
  if (!current.workbook) return null;
  const bytes = await readStoredBytes(env);
  if (!bytes) return null;
  return { fileName: current.workbook.fileName, bytes, overrides: await readOverridesFor(env) };
}

export async function readWorkbook(): Promise<StoredWorkbook> {
  const env = await cloudflareEnv();
  const stored = env ? await readCloudflare(env) : await readLocal();
  return {
    workbook: stored.workbook,
    incidents: stored.incidents.map((incident) => ({
      ...incident,
      date:
        incident.date == null
          ? null
          : incident.date instanceof Date
            ? incident.date
            : new Date(incident.date),
    })),
  };
}

export async function clearWorkbookStore(by = "Unknown"): Promise<void> {
  const env = await cloudflareEnv();
  const current = env ? await readCloudflare(env).catch(() => null) : await readLocal();
  const history: HistoryEntry[] = [
    {
      at: new Date().toISOString(),
      action: "remove",
      cell: "",
      field: "Workbook",
      oldValue: current?.workbook?.fileName ?? "",
      newValue: "",
      by,
    },
  ];
  if (env) {
    await clearCloudflare(env, history);
    return;
  }
  await clearLocal(history);
}

export type WorkbookSource = { source: "d1"; workbook: { fileName: string; importedAt: string; rowCount: number } | null } | { source: "local" };

/** On Cloudflare (D1 bound) the stored workbook's meta; "local" when running without D1 (dev / node). */
export async function readWorkbookSource(): Promise<WorkbookSource> {
  const env = await cloudflareEnv();
  if (!env) return { source: "local" };
  const row = await env.DB!.prepare("SELECT file_name, imported_at, row_count FROM workbook WHERE id = 1").first<{
    file_name: string;
    imported_at: string;
    row_count: number;
  }>();
  return { source: "d1", workbook: row ? { fileName: row.file_name, importedAt: row.imported_at, rowCount: row.row_count } : null };
}
