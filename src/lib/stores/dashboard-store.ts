"use client";

import { create } from "zustand";
import { buildDashboardData } from "@/lib/analytics";
import { STATIONS } from "@/lib/constants";
import { mergeIncidents } from "@/lib/merge-incidents";
import { parseWorkbook } from "@/lib/parse";
import type { WorkbookValidation } from "@/lib/validation/workbook";
import { validateWorkbook } from "@/lib/validation/workbook";
import { useErrorMonitorStore } from "@/lib/stores/error-monitor-store";
import type { DashboardData, GraphFilters, Incident } from "@/lib/types";

function verifyMonthlyTrendIntegrity(data: DashboardData) {
  const monthlySum = data.monthlyTrend.reduce((sum, point) => sum + point.total, 0);
  if (monthlySum !== data.incidents.length) {
    useErrorMonitorStore.getState().addError({
      source: "buildMonthlyTrend",
      message: `Monthly bucket total (${monthlySum}) does not match incident count (${data.incidents.length}).`,
    });
  }
}

type MergeResult = {
  added: number;
  skipped: number;
  fileName: string;
  blocked?: boolean;
};

type PendingLoad =
  | { kind: "upload"; file: File }
  | { kind: "data"; fileName: string };

type DashboardState = {
  workbookLoaded: boolean;
  fileName: string | null;
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  selectedIncident: Incident | null;
  graphFilters: GraphFilters;
  validation: WorkbookValidation | null;
  validationLoadAnyway: boolean;
  pendingLoad: PendingLoad | null;
  loadWorkbook: (file: File) => Promise<void>;
  mergeFromDataFile: (fileName: string) => Promise<MergeResult>;
  refreshFromDataFolder: () => Promise<MergeResult | null>;
  confirmValidationAndLoad: () => Promise<void>;
  dismissValidation: () => void;
  clearWorkbook: () => void;
  setSelectedIncident: (incident: Incident | null) => void;
  setGraphFilters: (filters: Partial<GraphFilters>) => void;
};

const defaultGraphFilters: GraphFilters = {
  year: "All",
  month: "All",
  station: "DEL",
  department: "All",
  category: "All",
};

function rebuildDashboard(
  incidents: Incident[],
  contributingFromSheet: { label: string; value: number }[] = [],
): DashboardData {
  return buildDashboardData({
    incidents,
    stationCodes: [...STATIONS],
    contributingFromSheet,
  });
}

function appendSourceName(current: string | null, next: string): string {
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current} + ${next}`;
}

async function fetchValidateFromData(fileName: string): Promise<WorkbookValidation> {
  const res = await fetch(`/api/data/validate?file=${encodeURIComponent(fileName)}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to validate workbook.");
  }
  return json as WorkbookValidation;
}

async function fetchIngestPayload(fileName: string): Promise<{
  fileName: string;
  incidents: Incident[];
  contributingFromSheet: { label: string; value: number }[];
}> {
  const res = await fetch(`/api/data/ingest?file=${encodeURIComponent(fileName)}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to ingest data file.");
  }
  return json;
}

async function executePendingLoad(
  pending: PendingLoad,
  getState: () => DashboardState,
  set: (partial: Partial<DashboardState>) => void,
): Promise<MergeResult | void> {
  if (pending.kind === "upload") {
    const buffer = await pending.file.arrayBuffer();
    const data = parseWorkbook(buffer);
    verifyMonthlyTrendIntegrity(data);
    set({
      workbookLoaded: true,
      fileName: pending.file.name,
      data,
      isLoading: false,
      error: null,
      validation: null,
      validationLoadAnyway: false,
      pendingLoad: null,
    });
    return;
  }

  const state = getState();
  const payload = await fetchIngestPayload(pending.fileName);
  const incoming = payload.incidents;

  if (!state.data) {
    const data = rebuildDashboard(incoming, payload.contributingFromSheet);
    verifyMonthlyTrendIntegrity(data);
    set({
      workbookLoaded: true,
      fileName: payload.fileName,
      data,
      isLoading: false,
      error: null,
      validation: null,
      validationLoadAnyway: false,
      pendingLoad: null,
    });
    return { added: incoming.length, skipped: 0, fileName: payload.fileName };
  }

  const { merged, added, skipped } = mergeIncidents(state.data.incidents, incoming);
  const data = rebuildDashboard(merged, payload.contributingFromSheet);
  verifyMonthlyTrendIntegrity(data);

  set({
    workbookLoaded: true,
    fileName: appendSourceName(state.fileName, payload.fileName),
    data,
    isLoading: false,
    error: null,
    validation: null,
    validationLoadAnyway: false,
    pendingLoad: null,
  });

  return { added, skipped, fileName: payload.fileName };
}

function shouldBlockLoad(
  validation: WorkbookValidation,
  loadAnyway: boolean,
): boolean {
  return validation.errorCount > 0 && !loadAnyway;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  workbookLoaded: false,
  fileName: null,
  data: null,
  isLoading: false,
  error: null,
  selectedIncident: null,
  graphFilters: defaultGraphFilters,
  validation: null,
  validationLoadAnyway: false,
  pendingLoad: null,

  loadWorkbook: async (file: File) => {
    set({
      isLoading: true,
      error: null,
      selectedIncident: null,
      validation: null,
      validationLoadAnyway: false,
      pendingLoad: null,
    });

    try {
      const buffer = await file.arrayBuffer();
      const validation = validateWorkbook(buffer, file.name);

      if (shouldBlockLoad(validation, false)) {
        set({
          isLoading: false,
          validation,
          pendingLoad: { kind: "upload", file },
          workbookLoaded: false,
        });
        return;
      }

      const data = parseWorkbook(buffer);
      verifyMonthlyTrendIntegrity(data);
      set({
        workbookLoaded: true,
        fileName: file.name,
        data,
        isLoading: false,
        error: null,
        validation: validation.warningCount > 0 ? validation : null,
        pendingLoad: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to parse the workbook.",
      });
    }
  },

  mergeFromDataFile: async (fileName: string) => {
    const state = get();
    set({ isLoading: true, error: null });

    try {
      if (!state.validationLoadAnyway) {
        const validation = await fetchValidateFromData(fileName);
        if (shouldBlockLoad(validation, false)) {
          set({
            isLoading: false,
            validation,
            pendingLoad: { kind: "data", fileName },
          });
          return {
            added: 0,
            skipped: 0,
            fileName,
            blocked: true,
          };
        }
        if (validation.warningCount > 0) {
          set({ validation });
        }
      }

      const result = await executePendingLoad(
        { kind: "data", fileName },
        get,
        set,
      );
      return (
        result ?? { added: 0, skipped: 0, fileName }
      );
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to merge data file.",
      });
      throw err;
    }
  },

  refreshFromDataFolder: async () => {
    const res = await fetch("/api/data/files");
    const json = await res.json();
    if (!res.ok || !json.files?.length) return null;

    const newest = json.files[0] as { name: string };
    return get().mergeFromDataFile(newest.name);
  },

  confirmValidationAndLoad: async () => {
    const { pendingLoad } = get();
    if (!pendingLoad) return;

    set({ isLoading: true, validationLoadAnyway: true, error: null });

    try {
      await executePendingLoad(pendingLoad, get, set);
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to load workbook.",
      });
    }
  },

  dismissValidation: () =>
    set({
      validation: null,
      pendingLoad: null,
      validationLoadAnyway: false,
      isLoading: false,
    }),

  clearWorkbook: () =>
    set({
      workbookLoaded: false,
      fileName: null,
      data: null,
      isLoading: false,
      error: null,
      selectedIncident: null,
      graphFilters: defaultGraphFilters,
      validation: null,
      validationLoadAnyway: false,
      pendingLoad: null,
    }),

  setSelectedIncident: (incident) => set({ selectedIncident: incident }),

  setGraphFilters: (filters) =>
    set((state) => ({
      graphFilters: { ...state.graphFilters, ...filters },
    })),
}));

export function useDashboardData(): DashboardData | null {
  return useDashboardStore((s) => s.data);
}
