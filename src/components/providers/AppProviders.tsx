"use client";

import dynamic from "next/dynamic";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorMonitorButton } from "@/components/ui/ErrorMonitorButton";

const SafetyBot = dynamic(
  () => import("@/components/ui/SafetyBot").then((m) => m.SafetyBot),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ErrorMonitorButton />
      <SafetyBot />
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
