"use client";

import { useCallback, useMemo, useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";
import { buildTreemapNodes, type TreemapNode } from "@/lib/treemap-theme";
import { EmptyState } from "@/components/ui/dashboard-primitives";

type HoverState = {
  node: TreemapNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TreemapCellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  node?: TreemapNode;
  onHover: (state: HoverState | null) => void;
  onHoverMove: (state: HoverState) => void;
};

function TreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name,
  node,
  onHover,
  onHoverMove,
}: TreemapCellProps) {
  if (!node || width < 2 || height < 2) return null;

  const showLabel = width >= 36 && height >= 26;
  const showCount = width >= 24 && height >= 20;

  const hoverPayload: HoverState = {
    node,
    x,
    y,
    width,
    height,
  };

  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ overflow: "visible" }}
    >
      <div
        className={`treemap-tile${node.isHighest ? " treemap-tile--pulse" : ""}`}
        style={{
          backgroundColor: node.fill,
          color: node.textColor,
        }}
        onMouseEnter={() => onHover(hoverPayload)}
        onMouseMove={() => onHoverMove(hoverPayload)}
        onMouseLeave={() => onHover(null)}
        role="img"
        aria-label={`${name ?? node.name}: ${node.count} incidents, rank ${node.rank}`}
      >
        {showLabel ? (
          <span className="treemap-tile__label" title={node.name}>
            {node.name}
          </span>
        ) : null}
        {showCount ? <span className="treemap-tile__count">{node.count}</span> : null}
      </div>
    </foreignObject>
  );
}

type TreemapChartProps = {
  labels: string[];
  values: number[];
  /** @deprecated Navy-gold palette is applied automatically by rank. */
  colors?: string[];
};

function hasChartData(values: number[]) {
  return values.length > 0 && values.some((v) => v > 0);
}

export function TreemapChart({ labels, values }: TreemapChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const nodes = useMemo(() => buildTreemapNodes(labels, values), [labels, values]);
  const nodeByName = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.name, n])),
    [nodes],
  );

  const onHover = useCallback((state: HoverState | null) => {
    setHover(state);
  }, []);

  const onHoverMove = useCallback((state: HoverState) => {
    setHover(state);
  }, []);

  if (!hasChartData(values)) {
    return <EmptyState message="No data for this chart with current filters." />;
  }

  return (
    <div className="treemap-chart relative h-full w-full min-h-0 overflow-hidden rounded-md bg-[var(--chart-bg)]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={nodes}
          dataKey="size"
          nameKey="name"
          stroke="transparent"
          isAnimationActive={false}
          content={
            ((props: { x?: number; y?: number; width?: number; height?: number; name?: string }) => (
              <TreemapCell
                {...props}
                node={nodeByName[props.name ?? ""]}
                onHover={onHover}
                onHoverMove={onHoverMove}
              />
            )) as never
          }
        />
      </ResponsiveContainer>

      {hover ? (
        <div
          className="treemap-tooltip pointer-events-none absolute z-20"
          style={{
            left: hover.x + hover.width / 2,
            top: Math.max(4, hover.y - 8),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold text-[#d4af37]">{hover.node.name}</p>
          <p className="mt-1 text-[#f8fafc]">
            Count: <span className="font-bold tabular-nums">{hover.node.count}</span>
          </p>
          <p className="text-[#cbd5e1]">
            Share: <span className="tabular-nums">{hover.node.pct}%</span>
          </p>
          <p className="text-[#94a3b8]">
            Rank: <span className="tabular-nums">#{hover.node.rank}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
