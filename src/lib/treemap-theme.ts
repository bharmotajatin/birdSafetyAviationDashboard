export const TREEMAP_NAVY = "#1a2a5e";
export const TREEMAP_GOLD = "#d4af37";
export const TREEMAP_NAVY_LIGHT = "#243666";
export const TREEMAP_GOLD_DARK = "#b8941f";

export type TreemapNode = {
  name: string;
  size: number;
  count: number;
  fill: string;
  textColor: string;
  rank: number;
  isHighest: boolean;
  pct: number;
};

export function buildTreemapNodes(labels: string[], values: number[]): TreemapNode[] {
  const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0) || 1;

  const entries = labels
    .map((name, i) => ({
      name,
      size: Math.max(Number(values[i]) || 0, 0),
      count: Math.max(Number(values[i]) || 0, 0),
    }))
    .filter((e) => e.size > 0);

  const ranked = [...entries].sort((a, b) => b.size - a.size);

  return ranked.map((entry, index) => {
    const rank = index + 1;
    let fill: string;
    let textColor: string;

    if (rank === 1) {
      fill = TREEMAP_GOLD;
      textColor = TREEMAP_NAVY;
    } else if (rank === 2) {
      fill = TREEMAP_NAVY;
      textColor = TREEMAP_GOLD;
    } else if (rank % 2 === 1) {
      fill = TREEMAP_NAVY_LIGHT;
      textColor = TREEMAP_GOLD;
    } else {
      fill = TREEMAP_GOLD_DARK;
      textColor = TREEMAP_NAVY;
    }

    return {
      ...entry,
      rank,
      fill,
      textColor,
      isHighest: rank === 1,
      pct: Math.round((entry.count / total) * 1000) / 10,
    };
  });
}
