import { BirdFlightMark } from "@/components/dashboard/BirdFlightLogo";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string | number;
  tone?: "default" | "red" | "amber" | "green" | "grey" | "gold";
  subtitle?: string;
};

const toneClasses = {
  default: "theme-text",
  red: "text-red-500",
  amber: "text-amber-500",
  green: "text-green-500",
  grey: "theme-text-muted",
  gold: "text-[var(--brand-gold)]",
};

export function KpiCard({ label, value, tone = "default", subtitle }: KpiCardProps) {
  return (
    <article className="glass-card p-4">
      <p className="text-sm theme-text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", toneClasses[tone])}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs theme-text-muted">{subtitle}</p> : null}
    </article>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-6 flex items-start gap-3">
      <BirdFlightMark size={44} className="mt-0.5 shrink-0 shadow-sm" />
      <div className="min-w-0">
        <h2 className="text-2xl font-bold theme-text">{title}</h2>
        <p className="mt-1 text-sm theme-text-muted">{subtitle}</p>
      </div>
    </header>
  );
}

export function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-[#d4af37]">{title}</h3>
      <div className="h-[280px]">{children}</div>
    </section>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card h-72" />
        <div className="glass-card h-72" />
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass-card flex min-h-[240px] items-center justify-center p-8 text-center">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
