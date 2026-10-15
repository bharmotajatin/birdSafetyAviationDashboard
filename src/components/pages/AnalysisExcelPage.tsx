"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Lock, XCircle } from "lucide-react";
import { READ_ONLY_CLIENT } from "@/lib/read-only";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import { readWorkbookMatrices } from "@/lib/parse/utils";
import { buildDataCheck, type DataCheckIssue } from "@/lib/data-check";
import { acceptancesFromCheck, fillAnalysisTemplate, HIDES_LINE, openUploadIssues, prepareAnalysis, type AnalysisModel, type GridCell, type SheetModel } from "@/lib/analysis-excel";
import { departmentsOf, incidentTypesOf } from "@/lib/analytics";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";

const TEMPLATE_URL = "/templates/Analysis_Excel_Template.xlsx";

type Loaded = {
  file: File;
  sheet: { name: string; rows: unknown[][] };
  issues: DataCheckIssue[];
};

function hoverText(cell: GridCell, model: AnalysisModel): string | undefined {
  const parts: string[] = [];
  if (cell.f) parts.push(`=${cell.f}`);
  if (cell.rows?.length) {
    const byRow = new Map(model.helpers.map((h) => [h.logRow, h]));
    const lines = cell.rows.slice(0, 12).map((r) => {
      const h = byRow.get(r);
      return h ? `Log row ${r} · S.No ${h.serialNo} · ${h.ghr} · ${h.title}` : `Log row ${r}`;
    });
    if (cell.rows.length > 12) lines.push(`…and ${cell.rows.length - 12} more`);
    parts.push(lines.join("\n"));
  }
  return parts.length ? parts.join("\n\n") : undefined;
}

function display(cell: GridCell): string {
  if (cell.kind === "percent" && typeof cell.v === "number") return `${(cell.v * 100).toFixed(1)}%`;
  return String(cell.v);
}

function SheetGrid({ sheet, model }: { sheet: SheetModel; model: AnalysisModel }) {
  return (
    <div>
      <p className="text-base font-bold theme-text">{sheet.title}</p>
      {sheet.note ? <p className="mb-2 text-xs italic theme-text-muted">{sheet.note}</p> : null}
      <div className="max-h-[520px] overflow-auto rounded-lg border theme-border">
        <table className="analysis-grid w-full border-collapse text-sm">
          <tbody>
            {sheet.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => {
                  const isHead = c.kind === "header";
                  const tip = hoverText(c, model);
                  return (
                    <td
                      key={ci}
                      title={tip}
                      className={cn(
                        "relative whitespace-nowrap border theme-border px-2 py-1",
                        isHead && "bg-[#1f2a5a] font-semibold text-white",
                        c.kind === "total" && "font-bold",
                        typeof c.v === "number" && "text-right tabular-nums",
                        c.kind === "hidden" && "italic text-slate-400",
                        c.rows?.length && "cursor-help underline decoration-dotted",
                      )}
                    >
                      {c.f ? (
                        <span className="mr-1 rounded bg-emerald-100 px-1 text-[9px] font-bold italic text-emerald-800" aria-label="formula">
                          fx
                        </span>
                      ) : null}
                      {c.link && !isHead ? <span className="text-[#1f4fd1]">{display(c)}</span> : display(c)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** PA-12: Exports > Analysis Excel — Step 1 upload, Step 2 preview, Step 3 download from DESIGNER's template. */
export function AnalysisExcelPage() {
  const loadWorkbook = useDashboardStore((s) => s.loadWorkbook);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Summary");
  const [downloading, setDownloading] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [hidePersonal, setHidePersonal] = useState(true);
  const [confirmOff, setConfirmOff] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setReplaced(false);
    try {
      const bytes = await file.arrayBuffer();
      const sheets = readWorkbookMatrices(bytes);
      const sheet =
        sheets.find((s) => s.rows.some((r) => r.some((c) => /^s\.?\s*no/i.test(String(c ?? ""))))) ?? sheets[0]!;
      let issues: DataCheckIssue[] = [];
      try {
        issues = buildDataCheck(bytes).issues;
      } catch {
        issues = [];
      }
      // Leave out issues already accepted on Data Check (matched by cell and value).
      try {
        const res = await fetch("/api/data/check", { cache: "no-store" });
        if (res.ok) issues = openUploadIssues(issues, acceptancesFromCheck(await res.json()));
      } catch {
        /* no stored workbook: show every issue in the file */
      }
      if (!prepareAnalysis(sheet, false).incidents.length) throw new Error("No incidents found. Upload the incident log (headers on row 4).");
      setLoaded({ file, sheet, issues });
      setTab("Summary");
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const prepared = useMemo(() => (loaded ? prepareAnalysis(loaded.sheet, hidePersonal || READ_ONLY_CLIENT) : null), [loaded, hidePersonal]);

  // independent cross-check with the dashboard's own split helpers
  const cross = useMemo(() => {
    if (!prepared) return null;
    const types = prepared.incidents.reduce((n, i) => n + new Set(incidentTypesOf(i)).size, 0);
    const depts = prepared.incidents.reduce((n, i) => n + new Set(departmentsOf(i)).size, 0);
    return { types, depts };
  }, [prepared]);

  const download = async () => {
    if (!loaded || !prepared) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(TEMPLATE_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load the Analysis Excel template.");
      const out = await fillAnalysisTemplate(await res.arrayBuffer(), { model: prepared.model, sourceRows: prepared.sourceRows, hidePersonal: hidePersonal || READ_ONLY_CLIENT });
      const blob = new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Analysis - ${loaded.file.name.replace(/\.xlsx?$/i, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const m = prepared?.model;
  const sheet = m?.sheets.find((s) => s.name === tab) ?? m?.sheets[0];
  const checks = m
    ? [
        { label: `${m.checks.incidents} incidents`, ok: m.checks.incidents === prepared!.incidents.length },
        { label: `${m.checks.typeEntries} types`, ok: cross?.types === m.checks.typeEntries },
        { label: `${m.checks.deptEntries} departments`, ok: cross?.depts === m.checks.deptEntries },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Analysis Excel"
        subtitle="Upload the incident log, preview every sheet, then download a workbook whose numbers are live formulas on the Log."
      />

      <section className="glass-card mb-4 p-4">
        <p className="mb-2 text-sm font-bold theme-text">Step 1 · Upload the incident log</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed theme-border px-4 py-3 text-sm font-semibold theme-text hover:border-[#d4af37]">
          <FileSpreadsheet size={16} aria-hidden />
          {busy ? "Reading…" : "Choose incident log (.xlsx)"}
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <p className="mt-2 text-xs theme-text-muted">
          Only the incident log is needed. It is read in your browser; the dashboard&apos;s stored workbook is not replaced unless you choose to.
        </p>
        {loaded ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm theme-text">
              <span className="font-semibold">{loaded.file.name}</span> · {prepared?.incidents.length ?? 0} incidents
            </p>
            {loaded.issues.length ? (
              <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={16} aria-hidden /> {loaded.issues.length} open data-check issue{loaded.issues.length === 1 ? "" : "s"} in this file
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {loaded.issues.slice(0, 5).map((i) => (
                    <li key={i.cell}>
                      Row {i.row}, {i.col} ({i.header}): {i.problem}
                      {i.value ? ` — "${i.value}"` : ""}
                    </li>
                  ))}
                  {loaded.issues.length > 5 ? <li>…and {loaded.issues.length - 5} more</li> : null}
                </ul>
                <Link href="/data-check" className="mt-2 inline-block font-semibold underline">
                  Fix first
                </Link>
                <span className="ml-2 text-xs">(Data Check works on the dashboard&apos;s stored workbook.)</span>
              </div>
            ) : null}
            <button
              type="button"
              disabled={replaced}
              onClick={async () => {
                await loadWorkbook(loaded.file);
                setReplaced(true);
              }}
              className="rounded-md border theme-border px-3 py-1.5 text-xs font-semibold theme-text disabled:opacity-50"
            >
              {replaced ? "Dashboard now uses this file" : "Also use this file for the dashboard (replaces stored workbook)"}
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>

      {m && sheet ? (
        <section className="glass-card mb-4 p-4">
          <p className="mb-2 text-sm font-bold theme-text">Step 2 · Preview</p>
          <p className="mb-3 flex flex-wrap gap-4 text-sm">
            {checks.map((c) => (
              <span key={c.label} className={cn("inline-flex items-center gap-1 font-semibold", c.ok ? "text-emerald-700" : "text-red-700")}>
                {c.ok ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
                {c.label}
              </span>
            ))}
            <span className="text-xs theme-text-muted">An incident with 2 types or 2 departments counts once in each.</span>
          </p>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {m.sheets.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setTab(s.name)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                  s.name === sheet.name ? "bg-[#1a2a5e] text-[#d4af37]" : "theme-text hover:bg-[var(--tab-hover-bg)]",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          <SheetGrid sheet={sheet} model={m} />
          <p className="mt-2 text-xs theme-text-muted">
            <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold italic text-emerald-800">fx</span> marks a formula cell. Hover a
            number to see the formula and the Log rows behind it.
          </p>
        </section>
      ) : null}

      <section className="glass-card p-4">
        <p className="mb-2 text-sm font-bold theme-text">Step 3 · Download</p>
        <div className="mb-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold theme-text">
            <button
              type="button"
              role="switch"
              aria-checked={hidePersonal || READ_ONLY_CLIENT}
              aria-disabled={READ_ONLY_CLIENT || undefined}
              disabled={READ_ONLY_CLIENT}
              title={READ_ONLY_CLIENT ? "Always on: this site is view only" : undefined}
              onClick={() => (READ_ONLY_CLIENT ? undefined : hidePersonal ? setConfirmOff(true) : setHidePersonal(true))}
              className={cn("relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed", hidePersonal || READ_ONLY_CLIENT ? "bg-emerald-600" : "bg-slate-300")}
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", hidePersonal ? "left-[18px]" : "left-0.5")} />
            </button>
            Hide personal details
            {READ_ONLY_CLIENT ? <Lock size={14} aria-label="Locked on" className="text-slate-500" /> : null}
          </label>
          <p className="mt-1 text-xs theme-text-muted">
            {HIDES_LINE}
            {prepared?.personalColumns.length ? ` Found: ${prepared.personalColumns.map((p) => p.header).join(", ")}.` : ""} Names from those columns and
            phone-like numbers (8+ digits) are also hidden in the description columns.
          </p>
          {confirmOff ? (
            <div className="mt-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">The downloaded file will contain personal data (names, staff and contact numbers).</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHidePersonal(false);
                    setConfirmOff(false);
                  }}
                  className="rounded-md border border-amber-500 px-3 py-1 text-xs font-semibold"
                >
                  Turn off anyway
                </button>
                <button type="button" onClick={() => setConfirmOff(false)} className="rounded-md bg-[#1a2a5e] px-3 py-1 text-xs font-semibold text-[#d4af37]">
                  Keep hidden
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!loaded || downloading}
          onClick={() => void download()}
          className="inline-flex items-center gap-2 rounded-md bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37] disabled:opacity-50"
        >
          <Download size={16} aria-hidden />
          {downloading ? "Building…" : "Download Analysis Excel"}
        </button>
        <p className="mt-2 text-xs theme-text-muted">
          Uses DESIGNER&apos;s template: Dashboard charts, Station, Category, Type, Department, Monthly, Not closed and Log. Excel recalculates every
          formula when the file opens.
        </p>
      </section>
    </div>
  );
}
