"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useErrorMonitorStore } from "@/lib/stores/error-monitor-store";

export function AnimatedCounter({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const addError = useErrorMonitorStore((s) => s.addError);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      addError({
        source: "AnimatedCounter",
        message: `Invalid KPI value received: ${String(value)}`,
      });
    }
  }, [value, addError]);

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = value * eased;
      setCount(decimals > 0 ? Math.round(current * 10) / 10 : Math.round(current));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, value, decimals]);

  const formatted =
    decimals > 0
      ? count.toFixed(decimals)
      : count.toLocaleString();

  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}
