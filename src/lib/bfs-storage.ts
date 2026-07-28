import type { Incident } from "@/lib/types";
import type { SafetyAnalysisResult } from "@/lib/safety-report/types";

export const BFS_STORAGE_KEYS = {
  incidents: "bfs_incident_data",
  analysis: "bfs_analysis_result",
  filename: "bfs_filename",
  lastUpdated: "bfs_last_updated",
} as const;

const INCIDENT_CAP = 500;

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  );
}

export function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!isQuotaError(error)) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Storage save failed:", error);
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("Storage full, saving reduced payload");
    }
    if (key === BFS_STORAGE_KEYS.incidents) {
      try {
        const incidents = JSON.parse(value) as Incident[];
        localStorage.setItem(
          key,
          JSON.stringify(incidents.slice(0, INCIDENT_CAP)),
        );
      } catch (parseError) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Storage save failed after trim:", parseError);
        }
      }
    }
  }
}

export function reviveIncidents(raw: unknown): Incident[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const incident = item as Incident & { date?: string | Date | null };
    const dateValue = incident.date;
    return {
      ...incident,
      date:
        dateValue == null
          ? null
          : dateValue instanceof Date
            ? dateValue
            : new Date(dateValue),
    };
  });
}

export function saveIncidentData(incidents: Incident[], filename: string): void {
  try {
    localStorage.removeItem(BFS_STORAGE_KEYS.analysis);
    safeSetStorage(BFS_STORAGE_KEYS.incidents, JSON.stringify(incidents));
    safeSetStorage(BFS_STORAGE_KEYS.filename, filename);
    safeSetStorage(BFS_STORAGE_KEYS.lastUpdated, new Date().toISOString());
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Storage save failed:", error);
    }
  }
}

export function saveAnalysisResult(result: SafetyAnalysisResult): void {
  try {
    safeSetStorage(BFS_STORAGE_KEYS.analysis, JSON.stringify(result));
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Analysis storage save failed:", error);
    }
  }
}

export function loadIncidentsFromStorage(): Incident[] | null {
  try {
    const raw = localStorage.getItem(BFS_STORAGE_KEYS.incidents);
    if (!raw) return null;
    const parsed = reviveIncidents(JSON.parse(raw));
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function loadFilenameFromStorage(): string | null {
  return localStorage.getItem(BFS_STORAGE_KEYS.filename);
}

export function loadAnalysisFromStorage(): SafetyAnalysisResult | null {
  try {
    const raw = localStorage.getItem(BFS_STORAGE_KEYS.analysis);
    if (!raw) return null;
    return JSON.parse(raw) as SafetyAnalysisResult;
  } catch {
    return null;
  }
}

export function loadLastUpdatedFromStorage(): Date | null {
  const raw = localStorage.getItem(BFS_STORAGE_KEYS.lastUpdated);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function clearBfsStorage(): void {
  localStorage.removeItem(BFS_STORAGE_KEYS.incidents);
  localStorage.removeItem(BFS_STORAGE_KEYS.analysis);
  localStorage.removeItem(BFS_STORAGE_KEYS.filename);
  localStorage.removeItem(BFS_STORAGE_KEYS.lastUpdated);
}

export function clearCorruptedBfsStorage(): void {
  clearBfsStorage();
}

export function formatTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function hoursSinceLastUpdated(): number | null {
  const updated = loadLastUpdatedFromStorage();
  if (!updated) return null;
  return (Date.now() - updated.getTime()) / 3600000;
}
