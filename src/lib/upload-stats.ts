/** Counters under the upload box, from the stored sheet (a dash until one is loaded). */
export function uploadStatCards(incidents: { station?: string }[] | undefined) {
  const list = incidents ?? [];
  const stations = new Set(list.map((i) => (i.station ?? "").trim()).filter((s) => s && s.toLowerCase() !== "unknown"));
  return [
    { label: "Incidents Tracked", value: list.length ? String(list.length) : "\u2014" },
    { label: "Stations Monitored", value: list.length ? String(stations.size) : "\u2014" },
    { label: "Analysis Sheets", value: "6" },
    { label: "Risk Scoring", value: "Real-time" },
  ];
}
