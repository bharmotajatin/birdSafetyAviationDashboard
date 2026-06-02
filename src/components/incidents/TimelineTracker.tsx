"use client";

import { useMemo, useState } from "react";

export type TimelineTrackerEvent = {
  _id: string;
  eventType: string;
  description: string;
  createdAt: string;
  performedBy?: { name?: string; email?: string };
  oldValue?: unknown;
  newValue?: unknown;
};

type TimelineTrackerProps = {
  events: TimelineTrackerEvent[];
};

function eventDotColor(event: TimelineTrackerEvent): string {
  const type = event.eventType.toLowerCase();
  const description = event.description.toLowerCase();
  if (type.includes("created")) return "#2563eb";
  if (type.includes("status")) return "#d97706";
  if (type.includes("closed") || type.includes("approved")) return "#16a34a";
  if (type.includes("review") || type.includes("rejected")) return "#9333ea";
  if (type.includes("sla") || description.includes("sla breach") || description.includes("overdue")) return "#dc2626";
  return "#64748b";
}

function formatTimeLabel(isoDate: string): string {
  const createdAt = new Date(isoDate);
  const diffMs = Date.now() - createdAt.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return createdAt.toLocaleString();
}

export function TimelineTracker({ events }: TimelineTrackerProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [events],
  );

  return (
    <div className="space-y-3">
      {sorted.map((event, index) => {
        const isExpanded = Boolean(expanded[event._id]);
        const hasDetails = event.oldValue != null || event.newValue != null;
        return (
          <div key={event._id} className="relative pl-10">
            {index < sorted.length - 1 ? (
              <span
                className="absolute left-[15px] top-6 h-[calc(100%-8px)] w-px bg-[#dbe3f1]"
                aria-hidden
              />
            ) : null}
            <span
              className="absolute left-0 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: eventDotColor(event) }}
              title={event.eventType}
            >
              {(event.performedBy?.name ?? "U").slice(0, 1).toUpperCase()}
            </span>

            <div className="rounded-lg border border-[#e5eaf4] bg-white px-3 py-2">
              <p className="text-sm font-semibold text-[#1a2a5e]">{event.eventType.replace(/_/g, " ")}</p>
              <p className="text-xs text-slate-500">
                {event.performedBy?.name ?? "Unknown"} · {formatTimeLabel(event.createdAt)}
              </p>
              <p className="mt-1 text-sm text-slate-700">{event.description}</p>

              {hasDetails ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [event._id]: !prev[event._id] }))}
                  className="mt-2 text-xs font-semibold text-[#1a2a5e] underline"
                >
                  {isExpanded ? "Hide details" : "Show details"}
                </button>
              ) : null}

              {isExpanded ? (
                <div className="mt-2 rounded border border-[#edf1f8] bg-slate-50 p-2 text-xs text-slate-700">
                  {event.oldValue != null ? (
                    <pre className="whitespace-pre-wrap">
                      <strong>From:</strong>{" "}
                      {typeof event.oldValue === "string"
                        ? event.oldValue
                        : JSON.stringify(event.oldValue, null, 2)}
                    </pre>
                  ) : null}
                  {event.newValue != null ? (
                    <pre className="whitespace-pre-wrap mt-2">
                      <strong>To:</strong>{" "}
                      {typeof event.newValue === "string"
                        ? event.newValue
                        : JSON.stringify(event.newValue, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {!sorted.length ? <p className="text-sm text-slate-500">No timeline events yet.</p> : null}
    </div>
  );
}
