"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, MoreHorizontal, Pin, PinOff } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { SharedFilterBar } from "@/components/layout/SharedFilterBar";
import { BOTTOM_BAR_GROUPS, NAV_GROUPS, findNav, tabMatches } from "@/lib/nav";
import { withSharedFilters } from "@/lib/url-filters";
import { cn } from "@/lib/utils";
import { useResponsiveTables } from "@/components/layout/useResponsiveTables";

/**
 * PA-12: DESIGNER's layout.
 * Desktop (>=1024px): left sidebar with labels, sub-tabs as a top strip.
 * Tablet (640-1023px): icon-only sidebar.
 * Phone (<640px): bottom bar with 5 groups + More (Exports).
 */
const PIN_KEY = "ssa.sidebar.pinned";
const pinListeners = new Set<() => void>();
function subscribePin(cb: () => void) {
  pinListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    pinListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const readPin = () => {
  try {
    return window.localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
};
function writePin(v: boolean) {
  try {
    window.localStorage.setItem(PIN_KEY, v ? "1" : "0");
  } catch {
    /* storage blocked: pin lasts for this page only */
  }
  pinListeners.forEach((cb) => cb());
}

/**
 * PA-17: desktop sidebar collapses to icons (64px) and opens as a 240px overlay on hover
 * (150ms delay in, 300ms out), keyboard focus, or a tap on the menu button on touch screens.
 * Pinned, it stays open and pushes the content. Tablet keeps the icon rail, phone the bottom bar.
 */
function useSidebar() {
  const pinned = useSyncExternalStore(subscribePin, readPin, () => false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const canHover = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px) and (hover: hover)").matches;
  const onEnter = useCallback(() => {
    if (!canHover()) return;
    clear();
    timer.current = setTimeout(() => setHoverOpen(true), 150);
  }, []);
  const onLeave = useCallback(() => {
    if (!canHover()) return;
    clear();
    timer.current = setTimeout(() => setHoverOpen(false), 300);
  }, []);
  const open = hoverOpen || focusOpen;
  return {
    pinned,
    open,
    /** labels / width classes: temporary open shows everywhere, pin applies on desktop only */
    wide: open ? "w-60" : pinned ? "w-16 lg:w-60" : "w-16",
    showLabel: open ? "inline" : pinned ? "hidden lg:inline" : "hidden",
    overlay: open && !pinned,
    togglePin: () => writePin(!pinned),
    toggleTap: () => {
      if (open) {
        setHoverOpen(false);
        setFocusOpen(false);
      } else setHoverOpen(true);
    },
    close: () => {
      setHoverOpen(false);
      setFocusOpen(false);
    },
    onEnter,
    onLeave,
    onFocus: () => setFocusOpen(true),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusOpen(false);
    },
  };
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const current = findNav(pathname);
  // "More" menu closes itself on navigation because it is tied to the path it was opened on.
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const moreOpen = moreFor === pathname;
  useResponsiveTables();
  const sb = useSidebar();
  useEffect(() => {
    const h = document.querySelector<HTMLElement>("header.glass-header");
    if (!h) return;
    const set = () => document.documentElement.style.setProperty("--app-header-h", `${h.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);
  // tap-opened overlay closes on navigation
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    sb.close();
  }

  const link = (href: string) => withSharedFilters(href, params);
  const groupHref = (id: string) => {
    const g = NAV_GROUPS.find((x) => x.id === id)!;
    return link(g.tabs[0]!.href);
  };

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
      {/* rail keeps 64px (240px pinned on desktop) in the flow; the open panel overflows it as an overlay */}
      <div className={cn("relative z-40 hidden shrink-0 transition-[width] duration-200 ease-out sm:block", sb.pinned ? "w-16 lg:w-60" : "w-16")}>
      <aside
        onMouseEnter={sb.onEnter}
        onMouseLeave={sb.onLeave}
        onFocus={sb.onFocus}
        onBlur={sb.onBlur}
        data-open={sb.open ? "true" : "false"}
        className={cn(
          "app-sidebar sticky flex flex-col overflow-hidden border-r theme-border bg-[var(--card-bg,#fff)] transition-[width,box-shadow] duration-200 ease-out",
          "top-[var(--app-header-h,64px)] h-[calc(100vh-var(--app-header-h,64px))]",
          sb.wide,
          sb.overlay && "shadow-2xl",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 px-3">
          <span className={cn("w-10 text-center text-[11px] font-bold uppercase tracking-wider theme-text-muted", sb.showLabel === "inline" ? "hidden" : sb.showLabel === "hidden" ? "inline" : "lg:hidden")}>SSA</span>
          <span className={cn("flex-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide theme-text-muted", sb.showLabel)}>Safety Sheet Analyser</span>
          <button
            type="button"
            onClick={sb.togglePin}
            aria-pressed={sb.pinned}
            aria-label={sb.pinned ? "Unpin sidebar" : "Pin sidebar open"}
            title={sb.pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={cn("hidden shrink-0 rounded-md p-1 theme-text-muted hover:bg-[var(--tab-hover-bg)]", sb.open || sb.pinned ? "lg:inline-flex" : "", sb.pinned && "text-[#d4af37]")}
          >
            {sb.pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
          </button>
        </div>
        <button
          type="button"
          onClick={sb.toggleTap}
          aria-expanded={sb.open}
          aria-label={sb.open ? "Close menu" : "Open menu"}
          title="Menu"
          className="mx-2 mb-1 flex h-10 items-center justify-center rounded-lg theme-text-muted hover:bg-[var(--tab-hover-bg)] lg:hidden"
        >
          <Menu size={18} aria-hidden />
        </button>
        <nav aria-label="Sections" className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {NAV_GROUPS.map((g) => {
            const Icon = g.icon;
            const active = current?.group.id === g.id;
            return (
              <div key={g.id}>
                <Link
                  href={groupHref(g.id)}
                  title={g.label}
                  aria-label={g.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 whitespace-nowrap rounded-lg px-[11px] text-sm font-medium transition-colors",
                    active
                      ? "bg-[#1a2a5e] text-[#d4af37] shadow-sm"
                      : "text-[var(--tab-inactive)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <Icon size={18} aria-hidden className="shrink-0" />
                  <span className={sb.showLabel}>{g.label}</span>
                </Link>
                {active && g.tabs.length > 1 ? (
                  <ul className={cn("mt-1 flex-col gap-0.5 pl-9", sb.showLabel === "inline" ? "flex" : sb.showLabel === "hidden" ? "hidden" : "hidden lg:flex")}>
                    {g.tabs.map((t) => {
                      const on = tabMatches(t, pathname);
                      return (
                        <li key={t.href}>
                          <Link
                            href={link(t.href)}
                            aria-current={on ? "page" : undefined}
                            className={cn(
                              "block whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium",
                              on ? "font-semibold text-[#d4af37]" : "text-[var(--tab-inactive)] hover:bg-[var(--tab-hover-bg)]",
                            )}
                          >
                            {t.label}
                            {t.comingSoon ? <span className="ml-1 text-[10px] text-slate-500">(soon)</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      </div>
      {sb.open ? <button type="button" aria-label="Close menu" onClick={sb.close} className="fixed inset-0 z-30 hidden bg-black/30 sm:block lg:hidden" /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {current && current.group.tabs.length > 1 ? (
          <nav aria-label={`${current.group.label} tabs`} className="glass-header border-b theme-border">
            <div className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
              {current.group.tabs.map((t) => {
                const active = tabMatches(t, pathname);
                return (
                  <Link
                    key={t.href}
                    href={link(t.href)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition",
                      active
                        ? "bg-[#1a2a5e] text-[#d4af37]"
                        : "text-[var(--tab-inactive)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    {t.label}
                    {t.comingSoon ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Soon</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
        <SharedFilterBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6">{children}</main>
      </div>
      </div>

      <nav
        aria-label="Sections"
        className="app-bottombar fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 border-t theme-border bg-[var(--card-bg,#fff)] sm:hidden"
      >
        {BOTTOM_BAR_GROUPS.map((id) => {
          const g = NAV_GROUPS.find((x) => x.id === id)!;
          const Icon = g.icon;
          const active = current?.group.id === id;
          return (
            <Link
              key={id}
              href={groupHref(id)}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", active ? "text-[#d4af37]" : "theme-text-muted")}
            >
              <Icon size={20} aria-hidden />
              {g.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreFor(moreOpen ? null : pathname)}
          aria-expanded={moreOpen}
          className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", current?.group.id === "exports" ? "text-[#d4af37]" : "theme-text-muted")}
        >
          <MoreHorizontal size={20} aria-hidden />
          More
        </button>
        {moreOpen ? (
          <div className="absolute bottom-full right-2 mb-2 w-56 rounded-xl border theme-border bg-[var(--card-bg,#fff)] p-2 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider theme-text-muted">Exports</p>
            {NAV_GROUPS.find((g) => g.id === "exports")!.tabs.map((t) => (
              <Link key={t.href} href={link(t.href)} className="block rounded-md px-2 py-2 text-sm theme-text hover:bg-[var(--tab-hover-bg)]">
                {t.label}
                {t.comingSoon ? <span className="ml-1 text-[10px] text-slate-500">(soon)</span> : null}
              </Link>
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
