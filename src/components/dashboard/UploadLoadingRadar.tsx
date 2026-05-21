"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BirdFlightMark } from "@/components/dashboard/BirdFlightLogo";

const STEPS = [
  "Reading workbook sheets…",
  "Validating incident schema…",
  "Parsing 63 incidents…",
  "Running risk calculations…",
  "Generating analytics…",
] as const;

export function UploadLoadingRadar({ compact = false }: { compact?: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const radarClass = compact ? "h-28 w-28" : "h-44 w-44";
  const orbitRadius = compact ? 52 : 78;
  const markSize = compact ? 32 : 48;

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`flex flex-col items-center ${compact ? "py-1" : "py-4"}`}>
      <div className={`upload-radar-loader relative flex ${radarClass} items-center justify-center`}>
        <div className="upload-orbit-ring absolute inset-0" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="upload-orbit-dot"
              style={{ transform: `rotate(${i * 60}deg) translateX(${orbitRadius}px)` }}
            />
          ))}
        </div>
        <div className="upload-radar-spin absolute inset-0 rounded-full" aria-hidden />
        <div className="relative z-10 flex items-center justify-center rounded-full bg-[#0a1628]/80">
          <BirdFlightMark size={markSize} />
        </div>
      </div>

      <div className={`h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10 ${compact ? "mt-3" : "mt-8"}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#e8c84a]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
      </div>

      <div className={`w-full max-w-sm text-center ${compact ? "mt-2 h-5" : "mt-5 h-6"}`}>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`font-medium text-white/80 ${compact ? "text-xs" : "text-sm"}`}
          >
            {STEPS[stepIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
