"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, EmptyState, LoadingSkeleton } from "@/components/ui/dashboard-primitives";
import type { HistoryEntry } from "@/lib/data-check";

function istTime(utc: string): string {
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return utc;
  return `${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} IST`;
}

/** PA-12: Data > Change history (read-only view of the Data Check audit trail). */
export function DataHistoryPage() {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/data/history", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { history?: HistoryEntry[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? "Failed to load history");
        setRows(j.history ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader title="Change history" subtitle="Every correction, acceptance and upload made through Data Check, newest first." />
      {error ? <div className="glass-card p-4 text-sm text-red-700">{error}</div> : null}
      {!rows && !error ? <LoadingSkeleton /> : null}
      {rows && rows.length === 0 ? <EmptyState message="No changes yet. Edits made on the Data Check page appear here." /> : null}
      {rows && rows.length > 0 ? (
        <div className="glass-card data-table-wrap overflow-auto">
          <table className="data-table w-full min-w-[880px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Cell</th>
                <th>Field</th>
                <th>Old value</th>
                <th>New value</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr key={`${h.at}-${i}`}>
                  <td>{istTime(h.at)}</td>
                  <td>{h.action}</td>
                  <td>
                    <Link href="/data-check" className="font-semibold text-[#1a2a5e] dark:text-[#d4af37]">
                      {h.cell}
                    </Link>
                  </td>
                  <td>{h.field}</td>
                  <td>{h.oldValue || "(blank)"}</td>
                  <td>{h.newValue || "(blank)"}</td>
                  <td>{h.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
