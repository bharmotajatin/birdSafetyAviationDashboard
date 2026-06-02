"use client";

import {
  getDateRange,
  getDeptColor,
  getMostCommon,
  type InjuryModalData,
} from "@/lib/injury-cluster-modal";

type InjurySourceModalProps = {
  modalData: InjuryModalData;
  onClose: () => void;
  onNavigateGhr: (ghr: string) => void;
};

export function InjurySourceModal({ modalData, onClose, onNavigateGhr }: InjurySourceModalProps) {
  const summaryStats = [
    { label: "Total Incidents", value: modalData.data.length, color: "#C0392B" },
    {
      label: "Unique Dept",
      value: new Set(modalData.data.map((row) => row.dept)).size,
      color: "#0D1F3C",
    },
    { label: "Date Range", value: getDateRange(modalData.data), color: "#D4A017" },
    {
      label: "Most Affected",
      value:
        modalData.type === "activitychart"
          ? getMostCommon(modalData.data, "activity")
          : getMostCommon(modalData.data, "bodyPart"),
      color: "#1A7A4A",
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "860px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #eeeeee",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#aaaaaa",
                marginBottom: "4px",
              }}
            >
              SOURCE DATA
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0D1F3C", margin: 0 }}>
              {modalData.title}
            </h3>
            <p style={{ fontSize: "12px", color: "#888888", margin: "4px 0 0" }}>
              {modalData.data.length} incidents · Click any GHR number to view full incident
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "1px solid #eeeeee",
              background: "#f5f5f5",
              cursor: "pointer",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666666",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            borderBottom: "1px solid #eeeeee",
            flexShrink: 0,
          }}
        >
          {summaryStats.map((stat, index) => (
            <div
              key={stat.label}
              style={{
                padding: "14px 20px",
                borderRight: index < 3 ? "1px solid #eeeeee" : "none",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#aaaaaa",
                  marginBottom: "4px",
                }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background: "#0D1F3C" }}>
                {["GHR No.", "Date", "Department", "Body Part", "Description", "Category"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "10px 14px",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modalData.data.map((incident, index) => {
                const deptStyle = getDeptColor(incident.dept);
                const rowBg = index % 2 === 0 ? "#ffffff" : "#F8F9FA";
                return (
                  <tr
                    key={`${incident.ghr}-${index}`}
                    style={{ background: rowBg, transition: "background 0.15s" }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "#EEF4FF";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = rowBg;
                    }}
                  >
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
                      <button
                        type="button"
                        onClick={() => onNavigateGhr(incident.ghr)}
                        style={{
                          background: "#EEF4FF",
                          border: "1px solid #B8D4F0",
                          borderRadius: "6px",
                          padding: "3px 10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#1A5FA8",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = "#0D1F3C";
                          event.currentTarget.style.color = "#ffffff";
                          event.currentTarget.style.borderColor = "#0D1F3C";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "#EEF4FF";
                          event.currentTarget.style.color = "#1A5FA8";
                          event.currentTarget.style.borderColor = "#B8D4F0";
                        }}
                      >
                        {incident.ghr}
                      </button>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#555555",
                        borderBottom: "1px solid #f0f0f0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {incident.date}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
                      <span
                        style={{
                          background: deptStyle.bg,
                          color: deptStyle.text,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {incident.dept}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#444444",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      {modalData.type === "activitychart" ? incident.activity ?? incident.bodyPart : incident.bodyPart}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#666666",
                        borderBottom: "1px solid #f0f0f0",
                        maxWidth: "240px",
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={incident.description}
                      >
                        {incident.description || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                          background:
                            incident.category === "CAT-A"
                              ? "#FEF0EF"
                              : incident.category === "CAT-B"
                                ? "#FFFBF0"
                                : "#F0FAF4",
                          color:
                            incident.category === "CAT-A"
                              ? "#C0392B"
                              : incident.category === "CAT-B"
                                ? "#D4A017"
                                : "#1A7A4A",
                        }}
                      >
                        {incident.category || "N/A"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #eeeeee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "#F8F9FA",
            borderRadius: "0 0 16px 16px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#aaaaaa" }}>
            Click any GHR number to navigate to the full incident
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 20px",
              background: "#0D1F3C",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
