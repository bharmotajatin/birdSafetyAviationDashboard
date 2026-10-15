"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { canGoBack, fallbackParent, readStack, recordVisit } from "@/lib/nav-history";
import { findNav } from "@/lib/nav";
import { withSharedFilters } from "@/lib/url-filters";

const SCROLL_KEY = "ssa.nav.scroll";
const RESTORE_KEY = "ssa.nav.restore";
function readScroll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function saveScroll(url: string, y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ ...readScroll(), [url]: y }));
  } catch {
    /* ignore */
  }
}
import { cn } from "@/lib/utils";

/** Records every in-app page visit (path + query) for the Back button. Mount once in the shell. */
export function NavHistoryTracker() {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const qs = params?.toString() ?? "";
  const url = qs ? `${pathname}?${qs}` : pathname;
  useEffect(() => {
    const before = readStack();
    const after = recordVisit(url);
    // a Back marks this url for scroll restore until it is done (survives the dev double effect)
    if (after.length < before.length) sessionStorage.setItem(RESTORE_KEY, url);
    const wentBack = sessionStorage.getItem(RESTORE_KEY) === url;
    // navigation starts with a click or key press, before Next.js scrolls the next page: snapshot now
    const snapshot = () => saveScroll(url, window.scrollY);
    document.addEventListener("pointerdown", snapshot, true);
    document.addEventListener("keydown", snapshot, true);
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (wentBack) {
      // charts and tables render after data loads, so retry until the page is tall enough (max ~2s)
      const target = readScroll()[url] ?? 0;
      const started = performance.now();
      const tick = () => {
        if (document.documentElement.scrollHeight - window.innerHeight >= target - 2 || performance.now() - started > 2500) {
          window.scrollTo(0, target);
          sessionStorage.removeItem(RESTORE_KEY);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      // start after Next.js has done its own scroll-to-segment for the new route
      if (target <= 0) sessionStorage.removeItem(RESTORE_KEY);
      else timer = setTimeout(() => (raf = requestAnimationFrame(tick)), 250);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      document.removeEventListener("pointerdown", snapshot, true);
      document.removeEventListener("keydown", snapshot, true);
    };
  }, [url]);
  return null;
}

/** Back to the exact previous in-app page (filters, query, scroll via the browser), else to fallback. */
export function useGoBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBack(readStack())) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}

export function BackButton({ fallback, className, label = "Back" }: { fallback: string; className?: string; label?: string }) {
  const goBack = useGoBack(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      data-testid="inline-back"
      aria-label="Go back to the previous page"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border theme-border px-2.5 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--tab-hover-bg)]",
        className,
      )}
    >
      <ArrowLeft size={16} aria-hidden />
      {label}
    </button>
  );
}

/**
 * One shared strip under the header: "? Back" then a clickable breadcrumb such as
 * "Stations ? Station-Wise ? DEL". Phone: "? Back" and the current page name only, on one line.
 */
export function PageBreadcrumb() {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const nav = findNav(pathname);
  const link = (href: string) => withSharedFilters(href, params);
  const station = params?.get("view") || params?.get("station") || "";
  const crumbs: { label: string; href: string }[] = [];
  if (nav) {
    crumbs.push({ label: nav.group.label, href: link(nav.group.tabs[0]!.href) });
    if (nav.group.tabs.length > 1 || nav.tab.label !== nav.group.label) crumbs.push({ label: nav.tab.label, href: link(nav.tab.href) });
  } else {
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    crumbs.push({ label: last.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), href: pathname });
  }
  if (station && station !== "All") {
    const qs = params?.toString() ?? "";
    crumbs.push({ label: station, href: qs ? `${pathname}?${qs}` : pathname });
  }
  const fallback = link(fallbackParent(pathname, nav?.group.tabs[0]?.href));
  const goBack = useGoBack(fallback);
  const current = crumbs[crumbs.length - 1];
  return (
    <nav aria-label="Breadcrumb" data-testid="page-breadcrumb" className="glass-header border-b theme-border">
      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap px-4 py-1.5 text-sm sm:px-6">
        <button
          type="button"
          onClick={goBack}
          data-testid="back-button"
          aria-label="Go back to the previous page"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-[#1a2a5e] hover:bg-[var(--tab-hover-bg)] dark:text-[#d4af37]"
        >
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        <span className="h-4 w-px shrink-0 bg-slate-300 dark:bg-white/20" aria-hidden />
        {/* phone: current page name only */}
        <span className="truncate font-medium text-[var(--text-primary)] sm:hidden" aria-current="page">
          {crumbs.length > 1 && station ? `${crumbs[crumbs.length - 2]!.label} ? ${current?.label}` : current?.label}
        </span>
        <ol className="hidden min-w-0 items-center gap-1 sm:flex">
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <ChevronRight size={14} className="shrink-0 theme-text-muted" aria-hidden /> : null}
              {i === crumbs.length - 1 ? (
                <span className="truncate font-medium text-[var(--text-primary)]" aria-current="page">{c.label}</span>
              ) : (
                <Link href={c.href} className="truncate theme-text-muted hover:text-[var(--text-primary)] hover:underline">
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
