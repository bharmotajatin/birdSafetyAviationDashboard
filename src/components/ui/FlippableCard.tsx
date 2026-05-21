"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FlippableCardProps = {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function FlippableCard({
  front,
  back,
  className,
  innerClassName,
}: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={cn("flip-card-wrap interactive-card", className)}
      style={{ perspective: "1000px" }}
    >
      <button
        type="button"
        className={cn("flip-card-inner w-full text-left", innerClassName)}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
      >
        <div className="flip-card-face flip-card-front">{front}</div>
        <div className="flip-card-face flip-card-back">{back}</div>
      </button>
    </div>
  );
}
