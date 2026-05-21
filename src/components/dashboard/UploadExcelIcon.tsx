"use client";

import { motion } from "framer-motion";

type Props = { className?: string; size?: number };

export function UploadExcelIcon({ className, size = 72 }: Props) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect
          x="12"
          y="8"
          width="40"
          height="48"
          rx="4"
          fill="rgba(212,175,55,0.12)"
          stroke="rgba(212,175,55,0.55)"
          strokeWidth="2"
        />
        <path
          d="M20 20H44M20 28H44M20 36H36"
          stroke="rgba(212,175,55,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="52" cy="52" r="14" fill="#d4af37" />
        <path
          d="M52 46V58M46 52H58"
          stroke="#1a2a5e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M48 56L52 52L56 56"
          stroke="#1a2a5e"
          strokeWidth="0"
          fill="none"
        />
        <path
          d="M48 48L52 44L56 48"
          stroke="#1a2a5e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M52 44V56"
          stroke="#1a2a5e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
