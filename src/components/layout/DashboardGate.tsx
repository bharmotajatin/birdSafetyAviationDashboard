"use client";

import { Header } from "@/components/layout/Header";
import { SheetTabs } from "@/components/layout/SheetTabs";

export function DashboardGate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SheetTabs />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
