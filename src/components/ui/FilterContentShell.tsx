"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { FilterLoadingOverlay } from "@/components/ui/FilterLoadingOverlay";

type FilterContentShellProps = {
  transitionKey: string;
  isPending?: boolean;
  minHeight?: number;
  children: ReactNode;
};

/** Persistent shell — inner content crossfades without unmounting the page layout. */
export function FilterContentShell({
  transitionKey,
  isPending = false,
  minHeight = 400,
  children,
}: FilterContentShellProps) {
  return (
    <div className="relative w-full" style={{ minHeight }}>
      <FilterLoadingOverlay isUpdating={isPending} />
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
