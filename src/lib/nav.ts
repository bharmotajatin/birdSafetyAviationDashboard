import {
  Building,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/** PA-12: DESIGNER's approved navigation — 6 groups, each with sub-tabs. */
export type NavTab = {
  href: string;
  label: string;
  /** Other routes that should highlight this tab (old URLs keep working). */
  aliases?: string[];
  /** Set for tabs that are not built yet: a short description of what they will show. */
  comingSoon?: string;
};

export type NavGroup = { id: string; label: string; icon: LucideIcon; tabs: NavTab[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    tabs: [{ href: "/overview", label: "Overview", aliases: ["/graphs"] }],
  },
  {
    id: "stations",
    label: "Stations",
    icon: Building,
    tabs: [
      { href: "/station-wise", label: "Station-Wise" },
      { href: "/pan-india", label: "Pan India" },
      { href: "/station-analysis", label: "Station Analysis" },
    ],
  },
  {
    id: "trends",
    label: "Trends",
    icon: TrendingUp,
    tabs: [
      { href: "/monthly", label: "Monthly" },
      { href: "/pattern-analysis", label: "Patterns" },
      {
        href: "/trends/time-of-day",
        label: "Time of day",
      },
      {
        href: "/trends/reporting-delay",
        label: "Reporting delay",
      },
    ],
  },
  {
    id: "incidents",
    label: "Incidents",
    icon: FileText,
    tabs: [
      { href: "/incident-log", label: "Incident Log" },
      {
        href: "/incidents/open-age",
        label: "Open incident age",
      },
      {
        href: "/incidents/repeat",
        label: "Repeat equipment and staff",
      },
    ],
  },
  {
    id: "data",
    label: "Data",
    icon: Database,
    tabs: [
      { href: "/data/upload", label: "Upload sheets" },
      { href: "/data-check", label: "Data Check" },
      { href: "/data/history", label: "Change history" },
    ],
  },
  {
    id: "exports",
    label: "Exports",
    icon: Download,
    tabs: [
      { href: "/exports/analysis-excel", label: "Analysis Excel" },
      {
        href: "/exports/dashboard",
        label: "Dashboard export",
      },
    ],
  },
];

/** Phone bottom bar shows these 5; Exports lives under More. */
export const BOTTOM_BAR_GROUPS = ["overview", "stations", "trends", "incidents", "data"];

export function tabMatches(tab: NavTab, pathname: string): boolean {
  return [tab.href, ...(tab.aliases ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

export function findNav(pathname: string): { group: NavGroup; tab: NavTab } | null {
  for (const group of NAV_GROUPS) {
    const tab = group.tabs.find((t) => tabMatches(t, pathname));
    if (tab) return { group, tab };
  }
  return null;
}

export function findComingSoon(href: string): NavTab | undefined {
  for (const g of NAV_GROUPS) {
    const t = g.tabs.find((x) => x.href === href && x.comingSoon);
    if (t) return t;
  }
  return undefined;
}
