"use client";

import { create } from "zustand";

export type ErrorEntry = {
  id: string;
  message: string;
  source: string;
  at: number;
};

type ErrorMonitorState = {
  errors: ErrorEntry[];
  addError: (entry: Omit<ErrorEntry, "id" | "at"> & { id?: string; at?: number }) => void;
  clearError: (id: string) => void;
  clearAll: () => void;
};

export const useErrorMonitorStore = create<ErrorMonitorState>((set) => ({
  errors: [],
  addError: (entry) =>
    set((state) => ({
      errors: [
        ...state.errors,
        {
          id: entry.id ?? `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message: entry.message,
          source: entry.source,
          at: entry.at ?? Date.now(),
        },
      ],
    })),
  clearError: (id) =>
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    })),
  clearAll: () => set({ errors: [] }),
}));
