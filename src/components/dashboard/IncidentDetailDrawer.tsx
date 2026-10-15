"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CategoryBadge } from "@/components/ui/badges";
import type { Incident } from "@/lib/types";

type Props = {
  incident: Incident | null;
  onClose: () => void;
  /** Current filtered list, used for Prev/Next and arrow-key navigation. */
  incidents?: Incident[];
  onNavigate?: (incident: Incident) => void;
};

const STATUS_PILL: Record<string, string> = {
  Closed: "bg-emerald-600 text-white",
  Open: "bg-red-600 text-white",
  "In Progress": "bg-amber-500 text-slate-950",
  Pending: "bg-blue-600 text-white",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL[status] ?? "bg-slate-600 text-white";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "Not set"}
    </span>
  );
}

export function IncidentDetailDrawer({ incident, onClose, incidents, onNavigate }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const open = !!incident;

  const list = incidents ?? [];
  const index = incident ? list.findIndex((i) => i.id === incident.id) : -1;
  const prev = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;

  const go = useCallback(
    (target: Incident | undefined) => {
      if (target && onNavigate) onNavigate(target);
    },
    [onNavigate],
  );

  // Open/close side effects: remember opener, lock scroll, hide FABs, restore focus.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("incident-modal-open");
    // PV-02: hide floating round buttons (Safety AI shield, error monitor) while open.
    const fabs = Array.from(document.querySelectorAll<HTMLElement>(".safety-bot-fab, .error-monitor-fab"));
    const fabDisplay = fabs.map((el) => el.style.display);
    fabs.forEach((el) => (el.style.display = "none"));
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("incident-modal-open");
      fabs.forEach((el, i) => (el.style.display = fabDisplay[i] ?? ""));
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        go(prev);
      } else if (e.key === "ArrowRight") {
        go(next);
      } else if (e.key === "Tab" && cardRef.current) {
        const items = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, go, prev, next]);

  // Scroll back to top when switching incidents.
  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
  }, [incident?.id]);

  if (!incident) return null;

  const navBtn =
    "rounded-full border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="incident-modal fixed inset-0 z-[9999] flex items-center justify-center sm:p-4">
      <div
        aria-hidden
        data-testid="incident-modal-backdrop"
        className="absolute inset-0 bg-black/50 backdrop-blur-[8px]"
        onClick={onClose}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-modal-title"
        className="relative flex h-full w-full flex-col overflow-y-auto bg-white text-slate-900 shadow-2xl sm:h-auto sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[900px] sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={incident.category} />
                <StatusPill status={incident.status} />
              </div>
              <h3 id="incident-modal-title" className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">
                {incident.title}
              </h3>
              <p className="text-sm font-medium text-[#8a6d12]">{incident.ghrNumber}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {list.length > 1 ? (
                <>
                  <button type="button" aria-label="Previous incident" className={navBtn} disabled={!prev} onClick={() => go(prev)}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Next incident" className={navBtn} disabled={!next} onClick={() => go(next)}>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
              <button
                ref={closeRef}
                type="button"
                aria-label="Close incident details"
                onClick={onClose}
                className="rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="incident-modal-body space-y-5 px-4 py-4 text-base leading-[1.6] sm:px-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <Info label="Date" value={incident.dateLabel} />
            <Info label="Time" value={incident.time} />
            <Info label="Location" value={incident.location} />
            <Info label="Person" value={incident.personInvolved} />
            <Info
              label="Station"
              value={isEmpty(incident.station) ? "Unknown" : incident.station}
              tag={incident.stationFromGhr ? "from GHR" : undefined}
              always
              warn={isEmpty(incident.station)}
            />
            <Info label="Department" value={incident.department} />
            <Info label="Incident type" value={incident.incidentType} />
            <Info label="Contributing factor" value={incident.contributingFactor} />
          </div>
          <Section title="Incident brief" text={incident.brief} />
          <Section title="Root cause" text={incident.rootCause} />
          <Section title="Corrective action" text={incident.correctiveAction} />
          <Section title="Preventive action" text={incident.preventiveAction} />
          <Section title="Immediate action" text={incident.immediateAction} />
          <Section title="Equipment" text={incident.equipment} />
        </div>
      </div>
    </div>
  );
}

const EMPTY = /^(|-+|\u2014|none|nil|n\/a|na|not set|unknown)$/i;
const isEmpty = (v: string | null | undefined) => EMPTY.test(String(v ?? "").trim());

function Info({
  label,
  value,
  tag,
  always,
  warn,
}: {
  label: string;
  value?: string;
  tag?: string;
  /** Show even when empty (Station). */
  always?: boolean;
  /** Amber text for a missing value (e.g. Unknown station). */
  warn?: boolean;
}) {
  if (!always && isEmpty(value)) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`break-words text-base ${warn ? "font-medium text-amber-600" : "text-slate-900"}`}>
        {value}
        {tag ? (
          <span
            title="Station cell is empty in the sheet; taken from the GHR number prefix"
            className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800"
          >
            {tag}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Section({ title, text }: { title: string; text?: string }) {
  if (isEmpty(text)) return null;
  return (
    <section>
      <h4 className="border-b border-[#d4af37]/40 pb-1 text-sm font-semibold uppercase tracking-wide text-[#a8841a]">
        {title}
      </h4>
      <p className="incident-modal-text mt-2 max-w-[75ch] whitespace-pre-wrap break-words text-base leading-[1.6] text-slate-800">
        {text}
      </p>
    </section>
  );
}