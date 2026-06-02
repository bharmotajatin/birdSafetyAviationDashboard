"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IncidentRow = {
  _id: string;
  ghrNo: string;
  dateOfIncident: string;
  incidentTitle: string;
  incidentType: string;
  incidentCategory: string;
  status: string;
  department?: { code?: string; name?: string };
  station?: { code?: string };
  assignedInvestigator?: { name?: string };
  slaDeadline?: string | null;
};

type Meta = {
  stations: Array<{ _id: string; code: string; fullName: string }>;
  departments: Array<{ _id: string; code: string; name: string }>;
};

function statusStyle(status: string) {
  if (status === "Closed") return "bg-emerald-100 text-emerald-700";
  if (status === "In Progress") return "bg-amber-100 text-amber-700";
  if (status === "Pending") return "bg-purple-100 text-purple-700";
  if (status === "Rejected") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function categoryStyle(category: string) {
  if (category === "CAT-A") return "bg-rose-100 text-rose-700";
  if (category === "CAT-B") return "bg-amber-100 text-amber-700";
  if (category === "CAT-C") return "bg-yellow-100 text-yellow-700";
  return "bg-emerald-100 text-emerald-700";
}

function daysOpen(dateOfIncident: string, slaDeadline?: string | null) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateOfIncident).getTime()) / 86400000));
  const overdue = slaDeadline ? new Date(slaDeadline).getTime() < Date.now() : false;
  return { days, overdue };
}

export default function IncidentsPage() {
  const [meta, setMeta] = useState<Meta>({ stations: [], departments: [] });
  const [loading, setLoading] = useState(false);
  const [incidentsData, setIncidentsData] = useState<{ items: IncidentRow[]; total: number; pages: number }>({
    items: [],
    total: 0,
    pages: 1,
  });

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [station, setStation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/incidents/meta");
      if (!res.ok) return;
      const json = await res.json();
      setMeta(json);
    };
    void run();
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (department) params.set("department", department);
    if (station) params.set("station", station);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [page, search, status, category, department, station, from, to]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/incidents?${queryString}`);
        if (!res.ok) return;
        const json = await res.json();
        setIncidentsData(json);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [queryString]);

  const items = incidentsData.items;
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggleSelect(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function exportSelected() {
    const selectedRows = items.filter((row) => selected[row._id]);
    if (!selectedRows.length) return;
    const header = ["GHR No", "Date", "Title", "Type", "Category", "Status", "Department", "Assigned To"];
    const lines = selectedRows.map((row) =>
      [
        row.ghrNo,
        new Date(row.dateOfIncident).toISOString().split("T")[0],
        row.incidentTitle,
        row.incidentType,
        row.incidentCategory,
        row.status,
        row.department?.code ?? "",
        row.assignedInvestigator?.name ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "incidents-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function bulkAssign() {
    if (!selectedIds.length) return;
    const investigatorId = window.prompt("Enter investigator user ID:");
    if (!investigatorId) return;
    await Promise.all(
      selectedIds.map((id) =>
        fetch(`/api/incidents/${id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ investigatorId }),
        }),
      ),
    );
    setSelected({});
    const res = await fetch(`/api/incidents?${queryString}`);
    if (res.ok) setIncidentsData(await res.json());
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1a2a5e]">Incidents</h1>
        <Link href="/incidents/new" className="rounded-lg bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37]">
          + New Incident
        </Link>
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3 md:grid-cols-4 lg:grid-cols-8">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded border px-2 py-1 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All Status</option>
          {["Open", "In Progress", "Pending", "Closed", "Reviewed", "Rejected"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All Category</option>
          {["CAT-A", "CAT-B", "CAT-C", "CAT-D"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All Dept</option>
          {meta.departments.map((d) => (
            <option key={d._id} value={d._id}>{d.code}</option>
          ))}
        </select>
        <select value={station} onChange={(e) => setStation(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All Station</option>
          {meta.stations.map((s) => (
            <option key={s._id} value={s._id}>{s.code}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
        <button onClick={() => setPage(1)} className="rounded border border-[#1a2a5e] px-2 py-1 text-sm text-[#1a2a5e]">Apply</button>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={exportSelected}
          disabled={!selectedIds.length}
          className="rounded border border-[#d4af37] px-3 py-1.5 text-sm font-semibold text-[#1a2a5e] disabled:opacity-50"
        >
          Export Selected
        </button>
        <button
          onClick={() => void bulkAssign()}
          disabled={!selectedIds.length}
          className="rounded border border-[#1a2a5e] px-3 py-1.5 text-sm font-semibold text-[#1a2a5e] disabled:opacity-50"
        >
          Assign Investigator
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-[#e2e8f0] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">GHR No</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Assigned To</th>
              <th className="px-3 py-2 text-left">Days Open</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const age = daysOpen(row.dateOfIncident, row.slaDeadline);
              return (
                <tr key={row._id} className="border-t border-[#e2e8f0]">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={Boolean(selected[row._id])} onChange={() => toggleSelect(row._id)} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#1a2a5e]">{row.ghrNo}</td>
                  <td className="px-3 py-2">{new Date(row.dateOfIncident).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{row.incidentTitle}</td>
                  <td className="px-3 py-2">{row.incidentType}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${categoryStyle(row.incidentCategory)}`}>{row.incidentCategory}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyle(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-2">{row.department?.code ?? "-"}</td>
                  <td className="px-3 py-2">{row.assignedInvestigator?.name ?? "Unassigned"}</td>
                  <td className={`px-3 py-2 font-semibold ${age.overdue ? "text-red-600" : "text-slate-700"}`}>{age.days}</td>
                  <td className="px-3 py-2">
                    <Link href={`/incidents/${row._id}`} className="text-[#1a2a5e] underline">View</Link>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  {loading ? "Loading incidents..." : "No incidents found"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>Total: {incidentsData.total}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-50">
            Prev
          </button>
          <span>Page {page} / {incidentsData.pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= incidentsData.pages} className="rounded border px-2 py-1 disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
