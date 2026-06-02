import type { CSSProperties } from "react";
import type { Incident } from "@/lib/types";

export function getCategoryStyle(category: string): CSSProperties {
  switch (category) {
    case "CAT-A":
      return {
        background: "rgba(239,68,68,0.15)",
        color: "#dc2626",
        border: "1px solid rgba(239,68,68,0.3)",
      };
    case "CAT-B":
      return {
        background: "rgba(245,158,11,0.15)",
        color: "#d97706",
        border: "1px solid rgba(245,158,11,0.3)",
      };
    case "CAT-C":
      return {
        background: "rgba(212,175,55,0.15)",
        color: "#92680a",
        border: "1px solid rgba(212,175,55,0.3)",
      };
    case "CAT-D":
      return {
        background: "rgba(34,197,94,0.15)",
        color: "#16a34a",
        border: "1px solid rgba(34,197,94,0.3)",
      };
    default:
      return {
        background: "rgba(100,116,139,0.15)",
        color: "#64748b",
        border: "1px solid rgba(100,116,139,0.3)",
      };
  }
}

export function getStatusDotColor(status: Incident["status"] | string): string {
  switch (status) {
    case "Open":
      return "#ef4444";
    case "Closed":
      return "#22c55e";
    case "In Progress":
      return "#f59e0b";
    case "Pending":
      return "#8b5cf6";
    default:
      return "#94a3b8";
  }
}
