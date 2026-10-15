import path from "path";
import type { Incident } from "@/lib/types";

const R2_KEY = "current-workbook";
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_META = path.join(LOCAL_DIR, "workbook.json");

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
  location, time_label, person_involved, equipment, contributing_factor, month_key
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

async function saveCloudflare(
  env: CfEnv,
  fileName: string,
  bytes: ArrayBuffer,
  incidents: Incident[],
): Promise<void> {
  const db = env.DB!;
  if (env.WORKBOOKS) {
    await env.WORKBOOKS.put(R2_KEY, bytes);
  }
  const importedAt = new Date().toISOString();
  const statements: D1Prepared[] = [
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
  const chunkSize = 40;
  for (let i = 0; i < statements.length; i += chunkSize) {
    await db.batch(statements.slice(i, i + chunkSize));
  }
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
              person_involved, equipment, contributing_factor, month_key
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

async function clearCloudflare(env: CfEnv): Promise<void> {
  const db = env.DB!;
  await db.batch([
    db.prepare("DELETE FROM incidents"),
    db.prepare("DELETE FROM workbook"),
  ]);
  if (env.WORKBOOKS) await env.WORKBOOKS.delete(R2_KEY);
}

async function ensureLocalDir(): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

async function saveLocal(
  fileName: string,
  bytes: ArrayBuffer,
  incidents: Incident[],
): Promise<void> {
  const fs = await import("fs/promises");
  await ensureLocalDir();
  await fs.writeFile(path.join(LOCAL_DIR, "current-workbook.bin"), Buffer.from(bytes));
  const payload: StoredWorkbook = {
    workbook: {
      fileName,
      r2Key: R2_KEY,
      importedAt: new Date().toISOString(),
      rowCount: incidents.length,
    },
    incidents,
  };
  await fs.writeFile(LOCAL_META, JSON.stringify(payload));
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

async function clearLocal(): Promise<void> {
  const fs = await import("fs/promises");
  await fs.rm(LOCAL_DIR, { recursive: true, force: true });
}

export async function saveWorkbook(
  fileName: string,
  bytes: ArrayBuffer,
  incidents: Incident[],
): Promise<StoredWorkbook["workbook"]> {
  const env = await cloudflareEnv();
  if (env) {
    await saveCloudflare(env, fileName, bytes, incidents);
  } else {
    await saveLocal(fileName, bytes, incidents);
  }
  return {
    fileName,
    r2Key: R2_KEY,
    importedAt: new Date().toISOString(),
    rowCount: incidents.length,
  };
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

export async function clearWorkbookStore(): Promise<void> {
  const env = await cloudflareEnv();
  if (env) {
    await clearCloudflare(env);
    return;
  }
  await clearLocal();
}
