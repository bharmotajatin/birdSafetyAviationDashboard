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
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition",
                active
                  ? "theme-bg-navy text-[var(--brand-gold)] shadow-sm"
                  : "text-[var(--tab-inactive)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-primary)]",
              )}
            >
              {route.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
