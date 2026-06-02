"use client";

import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";

type InjuryExploreCardProps = {
  children: ReactNode;
  onExplore: () => void;
  className?: string;
};

export function InjuryExploreCard({ children, onExplore, className = "" }: InjuryExploreCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExplore}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onExplore();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{
        cursor: "pointer",
        transition: "all 0.2s ease",
        borderRadius: "8px",
        border: hovered ? "2px solid #0D1F3C" : "2px solid transparent",
        boxShadow: hovered ? "0 4px 20px rgba(13,31,60,0.15)" : "none",
      }}
    >
      {children}
      <div
        style={{
          fontSize: "10px",
          color: "#aaaaaa",
          textAlign: "center",
          marginTop: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
        }}
      >
        <Search size={12} aria-hidden />
        Click to explore
      </div>
    </div>
  );
}
