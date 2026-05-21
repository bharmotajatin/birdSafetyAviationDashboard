import { CATEGORY_COLORS, DEPT_COLORS, STATUS_COLORS } from "@/lib/constants";
import type { Category, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryBadge({ category }: { category: Category | string }) {
  const color =
    CATEGORY_COLORS[category as Category] ?? "#64748b";
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {category}
    </span>
  );
}

export function StatusDot({ status }: { status: Status | string }) {
  const color = STATUS_COLORS[status as Status] ?? "#94a3b8";
  return (
    <span className="status-dot-text inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {status}
    </span>
  );
}

export function DeptPill({ department }: { department: string }) {
  const color =
    DEPT_COLORS[department as keyof typeof DEPT_COLORS] ?? DEPT_COLORS.OTHER;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {department}
    </span>
  );
}

export function RiskBadge({
  level,
  compact = false,
}: {
  level: "HIGH" | "MEDIUM" | "LOW";
  compact?: boolean;
}) {
  const styles = {
    HIGH: "bg-red-500/15 text-red-400",
    MEDIUM: "bg-amber-500/15 text-amber-400",
    LOW: "bg-green-500/15 text-green-400",
  };
  const icon = level === "HIGH" ? "🔴" : level === "MEDIUM" ? "⚠" : "✅";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full font-semibold whitespace-nowrap",
        compact ? "px-1.5 py-0.5 text-[10px] leading-none" : "gap-1 px-2 py-0.5 text-xs",
        styles[level],
      )}
    >
      {icon} {level}
    </span>
  );
}
