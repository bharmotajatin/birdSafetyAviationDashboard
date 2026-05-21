"use client";

import { Toaster } from "react-hot-toast";
import { DataFolderWatcher } from "@/components/layout/DataFolderWatcher";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <DataFolderWatcher />
      <Toaster
        position="top-right"
        toastOptions={{
          className: "toast-dashboard",
          style: {
            background: "var(--brand-navy)",
            color: "var(--text-on-navy)",
            border: "1px solid var(--chart-tooltip-border)",
          },
        }}
      />
    </ThemeProvider>
  );
}
