"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { cn } from "@/lib/utils";

export type KpiTone =
  | "default"
  | "gold"
  | "red"
  | "amber"
  | "green"
  | "purple";

const toneClasses: Record<KpiTone, string> = {
  default: "kpi-value-default",
  gold: "kpi-value-gold",
  red: "kpi-value-red",
  amber: "kpi-value-amber",
  green: "kpi-value-green",
  purple: "kpi-value-purple",
};

export function AnimatedKpiCard({
  label,
  value,
  textValue,
  tone = "default",
  index = 0,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  value?: number;
  textValue?: string;
  tone?: KpiTone;
  index?: number;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <motion.div variants={fadeUp} custom={index} className="min-w-0">
      <article className="kpi-card">
        <p className="kpi-card-label">{label}</p>
        <p className={cn("kpi-card-value", toneClasses[tone])}>
          {textValue != null ? (
            <>
              {textValue}
              {suffix}
            </>
          ) : (
            <AnimatedCounter value={value ?? 0} suffix={suffix} decimals={decimals} />
          )}
        </p>
      </article>
    </motion.div>
  );
}
