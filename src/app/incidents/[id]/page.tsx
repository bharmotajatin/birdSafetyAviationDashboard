"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TimelineTracker, type TimelineTrackerEvent } from "@/components/incidents/TimelineTracker";

type IncidentDetail = {
  _id: string;
  ghrNo: string;
  status: string;
  dateOfIncident: string;
  dateReported?: string;
  incidentTitle: string;
  incidentType: string;
  incidentCategory: string;
  operationalPhase: string;
  location: { text?: string; bay?: string; gate?: string; zone?: string };
  station?: { code?: string; fullName?: string };
  department?: { code?: string; name?: string };
  incidentBrief: string;
  personInvolved?: { name?: string; designation?: string; staffNo?: string; age?: number; gender?: string };
  injuryDetails?: { bodyPart?: string; severity?: string; treatment?: string };
  weatherConditions?: string;
  equipmentInvolved?: string;
  immediateAction?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  investigationNotes?: string;
  attachments?: Array<{ _id: string; url: string; originalName?: string; mimeType?: string }>;
  createdBy?: { _id?: string; name?: string; role?: string };
  assignedInvestigator?: { _id?: string; name?: string; role?: string };
  slaDeadline?: string;
};

type TimelineEvent = {
  _id: string;
  eventType: string;
  description: string;
  createdAt: string;
  performedBy?: { name?: string; email?: string };
  oldValue?: unknown;
  newValue?: unknown;
};

type SimilarIncident = {
  _id: string;
  ghrNo: string;
  incidentTitle: string;
  score: number;
  status: string;
};

function statusStyle(status: string) {
  if (status === "Closed") return "bg-emerald-100 text-emerald-700";
  if (status === "In Progress") return "bg-amber-100 text-amber-700";
  if (status === "Pending") return "bg-purple-100 text-purple-700";
  if (status === "Rejected") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function daysOpen(dateOfIncident: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateOfIncident).getTime()) / 86400000));
}

function formatHours(hours: number) {
  if (hours < 1) return "<1 hour";
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `${days}d ${rem}h`;
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = params.id;
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>("");
  const [related, setRelated] = useState<SimilarIncident[]>([]);
  const [sessionRole, setSessionRole] = useState<string>("viewer");

  const canAssign = ["admin", "safety_head"].includes(sessionRole);
  const canStatus = ["admin", "safety_head", "duty_manager"].includes(sessionRole);
  const canAddNote = ["admin", "safety_head", "investigator", "duty_manager"].includes(sessionRole);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [incidentRes, timelineRes, sessionRes] = await Promise.all([
        fetch(`/api/incidents/${incidentId}`),
        fetch(`/api/incidents/${incidentId}/timeline`),
        fetch("/api/auth/session"),
      ]);

      const incidentJson = await incidentRes.json();
      if (!incidentRes.ok) throw new Error(incidentJson.error ?? "Failed to load incident");
      setIncident(incidentJson.incident);
      setTimeline(incidentJson.timeline ?? (timelineRes.ok ? (await timelineRes.json()).timeline : []));

      if (sessionRes.ok) {
        const session = await sessionRes.json();
        setSessionRole(session?.user?.role ?? "viewer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load incident");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!incidentId) return;
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [incidentId]);

  useEffect(() => {
    const run = async () => {
      if (!incidentId) return;
      const [allRes, insightRes] = await Promise.all([
        fetch("/api/incidents?limit=100"),
        fetch(`/api/incidents/${incidentId}/insights`),
      ]);
      if (insightRes.ok) {
        const json = await insightRes.json();
        setInsights(json.insight ?? "");
      }
      if (allRes.ok && incident) {
        const json = await allRes.json();
        const candidates = (json.items ?? []) as IncidentDetail[];
        const scored = candidates
          .filter((row) => row._id !== incident._id)
          .map((row) => {
            let score = 0;
            if (row.incidentType === incident.incidentType) score += 3;
            if (row.department?.code && row.department.code === incident.department?.code) score += 2;
            if (row.station?.code && row.station.code === incident.station?.code) score += 2;
            if (row.incidentCategory === incident.incidentCategory) score += 1;
            return { _id: row._id, ghrNo: row.ghrNo, incidentTitle: row.incidentTitle, status: row.status, score };
          })
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setRelated(scored);
      }
    };
    void run();
  }, [incidentId, incident]);

  const noteEvents = useMemo(
    () => timeline.filter((event) => ["note_added", "comment"].includes(event.eventType)),
    [timeline],
  );

  const slaInfo = useMemo(() => {
    if (!incident?.slaDeadline) return null;
    const deadline = new Date(incident.slaDeadline);
    const diffHours = Math.floor((deadline.getTime() - Date.now()) / 3600000);
    const overdue = diffHours < 0;
    const progressPct = (() => {
      const total = deadline.getTime() - new Date(incident.dateOfIncident).getTime();
      if (total <= 0) return 100;
      const elapsed = Date.now() - new Date(incident.dateOfIncident).getTime();
      return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    })();
    const barColor = progressPct < 60 ? "#16a34a" : progressPct < 85 ? "#d97706" : "#dc2626";
    return { deadline, diffHours, overdue, progressPct, barColor };
  }, [incident]);

  async function assignInvestigator() {
    if (!incident) return;
    const investigatorId = window.prompt("Enter investigator user ID");
    if (!investigatorId) return;
    const res = await fetch(`/api/incidents/${incident._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investigatorId }),
    });
    if (!res.ok) {
      const json = await res.json();
      window.alert(json.error ?? "Failed to assign");
      return;
    }
    await loadData();
  }

  async function changeStatus() {
    if (!incident) return;
    const newStatus = window.prompt("New status (In Progress | Pending | Closed | Rejected)");
    if (!newStatus) return;
    const note = window.prompt("Status change note");
    if (!note) return;
    const res = await fetch(`/api/incidents/${incident._id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus, note }),
    });
    if (!res.ok) {
      const json = await res.json();
      window.alert(json.error ?? "Failed status update");
      return;
    }
    await loadData();
  }

  async function addNote() {
    if (!incident) return;
    const note = window.prompt("Add investigation note");
    if (!note) return;
    const merged = `${incident.investigationNotes ?? ""}\n- ${note}`.trim();
    const res = await fetch(`/api/incidents/${incident._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investigationNotes: merged }),
    });
    if (!res.ok) {
      const json = await res.json();
      window.alert(json.error ?? "Failed to add note");
      return;
    }
    await loadData();
  }

  async function uploadEvidence() {
    if (!incident) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.pdf";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) return;
      const formData = new FormData();
      Array.from(input.files).forEach((file) => formData.append("files", file));
      formData.append("captions", JSON.stringify(Array.from(input.files).map(() => "")));
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        window.alert(uploadJson.error ?? "Upload failed");
        return;
      }
      const current = incident.attachments ?? [];
      const merged = [...current, ...uploadJson.files].map((item: any) => item.filename ?? item._id);
      const patchRes = await fetch(`/api/incidents/${incident._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachments: merged }),
      });
      if (!patchRes.ok) {
        const json = await patchRes.json();
        window.alert(json.error ?? "Failed to attach evidence");
        return;
      }
      await loadData();
    };
    input.click();
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-6 text-slate-500">Loading incident...</main>;
  if (error || !incident) return <main className="mx-auto max-w-7xl px-4 py-6 text-red-600">{error ?? "Incident not found"}</main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-[#e2e8f0] bg-white p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Incident</p>
          <h1 className="text-2xl font-bold text-[#1a2a5e]">{incident.ghrNo}</h1>
          <p className="mt-1 text-sm text-slate-600">{incident.incidentTitle}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyle(incident.status)}`}>{incident.status}</span>
            <span className="text-xs text-slate-500">Days open: {daysOpen(incident.dateOfIncident)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssign ? <button onClick={() => void assignInvestigator()} className="rounded border px-3 py-1.5 text-sm text-[#1a2a5e]">Assign Investigator</button> : null}
          {canStatus ? <button onClick={() => void changeStatus()} className="rounded border px-3 py-1.5 text-sm text-[#1a2a5e]">Change Status</button> : null}
          {canAddNote ? <button onClick={() => void addNote()} className="rounded border px-3 py-1.5 text-sm text-[#1a2a5e]">Add Note</button> : null}
          {canAddNote ? <button onClick={() => void uploadEvidence()} className="rounded border px-3 py-1.5 text-sm text-[#1a2a5e]">Upload Evidence</button> : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Basic Information</h2>
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <p><strong>Date:</strong> {new Date(incident.dateOfIncident).toLocaleString()}</p>
              <p><strong>Category:</strong> {incident.incidentCategory}</p>
              <p><strong>Type:</strong> {incident.incidentType}</p>
              <p><strong>Operational Phase:</strong> {incident.operationalPhase}</p>
              <p><strong>Station:</strong> {incident.station?.code ?? "-"}</p>
              <p><strong>Department:</strong> {incident.department?.code ?? "-"}</p>
              <p><strong>Location:</strong> {incident.location?.text ?? "-"} ({incident.location?.bay ?? "-"} / {incident.location?.gate ?? "-"})</p>
              <p><strong>Assigned Investigator:</strong> {incident.assignedInvestigator?.name ?? "Unassigned"}</p>
            </div>
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{incident.incidentBrief}</p>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">SLA Status</h2>
            {slaInfo ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  <strong>Deadline:</strong> {slaInfo.deadline.toLocaleString()}
                </p>
                <p className={`text-sm font-semibold ${slaInfo.overdue ? "text-red-600" : "text-emerald-700"}`}>
                  {slaInfo.overdue
                    ? `Overdue by ${formatHours(Math.abs(slaInfo.diffHours))}`
                    : `Time remaining: ${formatHours(slaInfo.diffHours)}`}
                </p>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${slaInfo.progressPct}%`, background: slaInfo.barColor }}
                  />
                </div>
                <p className="text-xs text-slate-500">SLA progress: {slaInfo.progressPct}%</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No SLA deadline set.</p>
            )}
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Person Involved</h2>
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <p><strong>Name:</strong> {incident.personInvolved?.name ?? "-"}</p>
              <p><strong>Designation:</strong> {incident.personInvolved?.designation ?? "-"}</p>
              <p><strong>Staff No:</strong> {incident.personInvolved?.staffNo ?? "-"}</p>
              <p><strong>Age / Gender:</strong> {incident.personInvolved?.age ?? "-"} / {incident.personInvolved?.gender ?? "-"}</p>
              <p><strong>Body Part:</strong> {incident.injuryDetails?.bodyPart ?? "-"}</p>
              <p><strong>Severity:</strong> {incident.injuryDetails?.severity ?? "-"}</p>
            </div>
            <p className="mt-2 text-sm"><strong>Treatment:</strong> {incident.injuryDetails?.treatment ?? "-"}</p>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Photo Gallery / Evidence</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(incident.attachments ?? []).map((file) => (
                <button
                  key={file._id}
                  onClick={() => setLightbox(file.url)}
                  className="rounded border border-[#dbe2f1] p-2 text-left"
                >
                  {file.mimeType?.startsWith("image/") ? (
                    <img src={file.url} alt={file.originalName ?? "attachment"} className="h-28 w-full rounded object-cover" />
                  ) : (
                    <div className="h-28 flex items-center justify-center text-sm text-[#1a2a5e]">PDF Evidence</div>
                  )}
                  <p className="mt-1 truncate text-xs text-slate-600">{file.originalName ?? "Attachment"}</p>
                </button>
              ))}
              {!incident.attachments?.length ? <p className="text-sm text-slate-500">No attachments.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Investigation Notes (Threaded)</h2>
            <div className="space-y-2">
              {noteEvents.map((event) => (
                <div key={event._id} className="rounded border border-[#e8edf8] bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">{event.performedBy?.name ?? "User"} · {new Date(event.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-slate-700">{event.description}</p>
                </div>
              ))}
              {!noteEvents.length ? <p className="text-sm text-slate-500">No notes yet.</p> : null}
            </div>
            {incident.investigationNotes ? (
              <pre className="mt-3 whitespace-pre-wrap rounded border border-[#e2e8f0] bg-white p-3 text-sm text-slate-700">{incident.investigationNotes}</pre>
            ) : null}
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Corrective & Preventive Actions</h2>
            <p className="text-sm"><strong>Immediate:</strong> {incident.immediateAction || "-"}</p>
            <p className="mt-2 text-sm"><strong>Root Cause:</strong> {incident.rootCause || "-"}</p>
            <p className="mt-2 text-sm"><strong>Corrective:</strong> {incident.correctiveAction || "-"}</p>
            <p className="mt-2 text-sm"><strong>Preventive:</strong> {incident.preventiveAction || "-"}</p>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Related Incidents</h2>
            <div className="space-y-2">
              {related.map((item) => (
                <Link key={item._id} href={`/incidents/${item._id}`} className="flex items-center justify-between rounded border border-[#e2e8f0] px-3 py-2">
                  <span className="text-sm text-[#1a2a5e]">{item.ghrNo} · {item.incidentTitle}</span>
                  <span className="text-xs text-slate-500">Similarity: {item.score}</span>
                </Link>
              ))}
              {!related.length ? <p className="text-sm text-slate-500">No similar incidents found.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">AI Insights</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{insights || "Loading AI insights..."}</p>
          </section>
        </div>

        <aside className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Timeline</h2>
          <TimelineTracker events={timeline as TimelineTrackerEvent[]} />
        </aside>
      </div>

      {lightbox ? (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <img src={lightbox} alt="Evidence" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      ) : null}
    </main>
  );
}
