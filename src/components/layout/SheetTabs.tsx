"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SheetTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="glass-header border-b theme-border"
      aria-label="Dashboard navigation"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {ROUTES.map((route) => {
          const active = pathname === route.href;
          const Icon = route.icon;
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "inline-flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition border-l-2",
                active
                  ? "bg-[#1a2a5e] text-[#d4af37] border-l-[#d4af37] shadow-sm"
                  : "border-l-transparent text-[var(--tab-inactive)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {Icon ? <Icon size={14} aria-hidden /> : null}
                {route.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
