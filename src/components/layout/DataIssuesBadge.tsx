"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

/** PA-12: header badge with the number of open Data Check issues, linked to /data-check. */
export function DataIssuesBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/data/check", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { issues?: unknown[] } | null) => {
          if (!cancelled) setCount(Array.isArray(j?.issues) ? j!.issues!.length : null);
        })
        .catch(() => !cancelled && setCount(null));
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("data-check-changed", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("data-check-changed", onFocus);
    };
  }, [pathname]);

  if (!count) return null;
  return (
    <Link
      href="/data-check"
      title={`${count} open data-check issue${count === 1 ? "" : "s"}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
    >
      <AlertTriangle size={12} aria-hidden />
      <span>{count}</span>
      <span className="hidden sm:inline">data issue{count === 1 ? "" : "s"}</span>
    </Link>
  );
}
