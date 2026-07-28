"use client";

import { X } from "lucide-react";
import { CategoryBadge, StatusDot } from "@/components/ui/badges";
import type { Incident } from "@/lib/types";

type Props = {
  incident: Incident | null;
  onClose: () => void;
};

export function IncidentDetailDrawer({ incident, onClose }: Props) {
  if (!incident) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close detail panel"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-4">
          <div>
            <CategoryBadge category={incident.category} />
            <h3 className="mt-2 text-lg font-semibold text-white">{incident.title}</h3>
            <p className="text-sm text-[#d4af37]">{incident.ghrNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Date" value={incident.dateLabel} />
            <Info label="Time" value={incident.time || "—"} />
            <Info label="Location" value={incident.location || "—"} />
            <Info label="Person" value={incident.personInvolved || "—"} />
            <Info label="Station" value={incident.station} />
            <Info label="Department" value={incident.department} />
          </div>
          <StatusDot status={incident.status} />
          <Section title="Incident brief" text={incident.brief} />
          <Section title="Root cause" text={incident.rootCause} />
          <Section title="Corrective action" text={incident.correctiveAction} />
          <Section title="Immediate action" text={incident.immediateAction} />
          {incident.equipment ? (
            <Section title="Equipment" text={incident.equipment} />
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-200">{value}</p>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#d4af37]">
        {title}
      </p>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-slate-300">
        {text || "—"}
      </p>
    </div>
  );
}
