export type IncidentLogBotFilters = {
  category?: string;
  status?: string;
  department?: string;
  station?: string;
  search?: string;
};

const STORAGE_KEY = "bfs-safety-bot-incident-log-filters";

export function saveIncidentLogFilters(filters: IncidentLogBotFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

export function readIncidentLogFilters(): IncidentLogBotFilters | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IncidentLogBotFilters;
  } catch {
    return null;
  }
}

export function clearIncidentLogFilters() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
