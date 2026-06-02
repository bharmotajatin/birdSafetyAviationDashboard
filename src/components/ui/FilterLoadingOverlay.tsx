"use client";

export function FilterLoadingOverlay({ isUpdating }: { isUpdating: boolean }) {
  if (!isUpdating) return null;
  return (
    <div
      className="filter-loading-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        background: "rgba(255,255,255,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "inherit",
        backdropFilter: "blur(1px)",
      }}
      aria-hidden
    >
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="filter-loading-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#d4af37",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
