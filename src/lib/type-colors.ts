import { isNotSetLabel } from "./parse/utils";

/** One fixed colour per incident type, shared by every type chart and popup. */
const KNOWN_TYPE_COLORS: Record<string, string> = {
  "GSE Damage": "#1a2a5e",
  "Collision/Impact": "#d4af37",
  "Staff Injury": "#ef4444",
  "Near Miss": "#f59e0b",
  "Dropped Unit/Load": "#8b5cf6",
  "ULD Handling": "#0ea5e9",
  "A/C Damage": "#dc2626",
  "Non-compliance": "#14b8a6",
  "Slip/Trip": "#ec4899",
  "Other Agency GSE Damage": "#6366f1",
  Other: "#a3a3a3",
  Fire: "#ea580c",
  Spillage: "#22c55e",
};

const FALLBACK_PALETTE = [
  "#0891b2", "#65a30d", "#c026d3", "#b45309", "#4f46e5", "#be123c",
  "#0f766e", "#7c3aed", "#ca8a04", "#2563eb", "#9333ea", "#059669",
];

export const NOT_SET_COLOR = "#64748b";

export function typeColor(label: string): string {
  if (isNotSetLabel(label)) return NOT_SET_COLOR;
  const known = KNOWN_TYPE_COLORS[label];
  if (known) return known;
  let hash = 0;
  for (const ch of label.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]!;
}
