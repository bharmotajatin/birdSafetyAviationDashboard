"use client";

import { BackButton } from "@/components/layout/BackButton";
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/dashboard-primitives";
import type {
  CellAcceptance,
  CellOverride,
  DataCheckField,
  DataCheckIssue,
  DataCheckResult,
  HistoryEntry,
} from "@/lib/data-check";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";
import { READ_ONLY_CLIENT } from "@/lib/read-only";

type CheckResponse = DataCheckResult & {
  fileName: string;
  overrides: CellOverride[];
  acceptedIssues: (DataCheckIssue & { acceptance: CellAcceptance })[];
};

/** PA-09b: no auth yet — the name typed here is stored in localStorage and sent with every change. */
const NAME_KEY = "dataCheckUserName";
const NAME_EVENT = "data-check-name";
function subscribeName(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(NAME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(NAME_EVENT, cb);
  };
}
function useUserName(): [string, (name: string) => void] {
  const name = useSyncExternalStore(
    subscribeName,
    () => window.localStorage.getItem(NAME_KEY) ?? "",
    () => "",
  );
  const setName = (value: string) => {
    window.localStorage.setItem(NAME_KEY, value);
    window.dispatchEvent(new Event(NAME_EVENT));
  };
  return [name, setName];
}

/** UTC ISO → "15 Oct 2026, 13:47 IST". */
function formatIst(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} IST`;
}

const ACTION_LABEL: Record<HistoryEntry["action"], string> = {
  save: "Saved",
  revert: "Reverted",
  accept: "Accepted as is",
  "undo-accept": "Undid acceptance",
  upload: "Uploaded workbook",
  remove: "Removed workbook",
};
type EditState = { cell: string; row: number; col: string; field?: DataCheckField; draft: string };

/** Inline editor: dropdown for fixed-value fields, text input otherwise; Save/Cancel + Enter/Esc. */
function CellEditor({
  edit,
  options,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  edit: EditState;
  options: string[] | null;
  saving: boolean;
  onChange: (draft: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  return (
    <div
      className="absolute left-0 top-0 z-40 flex min-w-[260px] items-center gap-1 rounded-md border border-sky-500 bg-white p-1 shadow-lg dark:bg-slate-900"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className="px-1 font-mono text-[10px] font-semibold text-sky-600">{edit.cell}</span>
      {options ? (
        <select
          autoFocus
          disabled={saving}
          aria-label={`New value for ${edit.cell}`}
          className="min-w-0 flex-1 rounded border theme-border bg-transparent px-1 py-0.5 text-[11px]"
          value={edit.draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        >
          {!options.includes(edit.draft) ? <option value={edit.draft}>{edit.draft || "(blank) – choose…"}</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          disabled={saving}
          aria-label={`New value for ${edit.cell}`}
          className="min-w-0 flex-1 rounded border theme-border bg-transparent px-1 py-0.5 text-[11px] outline-none focus:border-sky-500"
          value={edit.draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      )}
      <button
        type="button"
        disabled={saving}
        className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className="rounded px-2 py-0.5 text-[11px] hover:bg-slate-500/15" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

const FIELD_LABELS: Record<DataCheckField, string> = {
  station: "Station",
  status: "Status",
  category: "Category",
  incidentType: "Incident type",
  date: "Date",
};

async function fetchCheck(): Promise<{ ok: boolean; json: CheckResponse | { error?: string } }> {
  try {
    const res = await fetch("/api/data/check", { cache: "no-store" });
    return { ok: res.ok, json: await res.json() };
  } catch {
    return { ok: false, json: { error: "Could not run the data check." } };
  }
}

/** PA-09: Data Check — issue list + Excel-style grid with inline corrections. */
export function DataCheckPage() {
  const [data, setData] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusCell, setFocusCell] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [tab, setTab] = useState<"issues" | "accepted" | "history">("issues");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [userName, setUserName] = useUserName();
  const who = userName.trim() || "Unknown";
  const userHeaders = { "Content-Type": "application/json", "X-User-Name": encodeURIComponent(who) };
  const hydrateFromServer = useDashboardStore((s) => s.hydrateFromServer);
  const gridRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((result: { ok: boolean; json: CheckResponse | { error?: string } }) => {
    if (result.ok) {
      setError(null);
      setData(result.json as CheckResponse);
    } else {
      setError((result.json as { error?: string }).error ?? "Could not run the data check.");
      setData(null);
    }
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/data/history", { cache: "no-store" });
      if (res.ok) setHistory(((await res.json()) as { history: HistoryEntry[] }).history);
    } catch {
      /* history is optional */
    }
  }, []);
  const load = useCallback(async () => {
    apply(await fetchCheck());
    await loadHistory();
  }, [apply, loadHistory]);

  useEffect(() => {
    let cancelled = false;
    fetchCheck().then((result) => {
      if (!cancelled) apply(result);
    });
    fetch("/api/data/history", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((json: { history: HistoryEntry[] }) => {
        if (!cancelled) setHistory(json.history ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const issuesByCell = useMemo(() => {
    const map = new Map<string, DataCheckIssue[]>();
    for (const issue of data?.issues ?? []) map.set(issue.cell, [...(map.get(issue.cell) ?? []), issue]);
    return map;
  }, [data]);
  const acceptedByCell = useMemo(
    () => new Map((data?.acceptedIssues ?? []).map((i) => [i.cell, i])),
    [data],
  );
  const overrideByCell = useMemo(
    () => new Map((data?.overrides ?? []).map((o) => [`${o.col}${o.row}`, o])),
    [data],
  );
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of data?.issues ?? []) counts.set(FIELD_LABELS[i.field], (counts.get(FIELD_LABELS[i.field]) ?? 0) + 1);
    return [...counts.entries()];
  }, [data]);

  const save = async (row: number, col: string, value: string | null) => {
    setSaving(true);
    const cell = `${col}${row}`;
    try {
      const res = await fetch(value == null ? `/api/data/overrides?row=${row}&col=${col}` : "/api/data/overrides", {
        method: value == null ? "DELETE" : "POST",
        headers: userHeaders,
        body: value == null ? undefined : JSON.stringify({ row, col, value }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(`Could not save ${cell}: ${json.error ?? res.statusText}`);
        return;
      }
      toast.success(value == null ? `Reverted ${cell} to the original value` : `Saved ${cell} = ${value || "(blank)"}`);
      await load();
      // Charts on every page read the store; refresh it from the corrected server data.
      await hydrateFromServer();
    } catch {
      toast.error(`Could not save ${cell}: network error`);
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  const setAcceptance = async (row: number, col: string, accept: boolean) => {
    setSaving(true);
    const cell = `${col}${row}`;
    try {
      const res = await fetch(accept ? "/api/data/acceptances" : `/api/data/acceptances?row=${row}&col=${col}`, {
        method: accept ? "POST" : "DELETE",
        headers: userHeaders,
        body: accept ? JSON.stringify({ row, col }) : undefined,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(`Could not update ${cell}: ${json.error ?? res.statusText}`);
        return;
      }
      toast.success(accept ? `Accepted ${cell} as is` : `Undid acceptance of ${cell}`);
      await load();
    } catch {
      toast.error(`Could not update ${cell}: network error`);
    } finally {
      setSaving(false);
    }
  };

  const columnFor = (letter: string) => data?.columns.find((c) => c.letter === letter);
  const cellValue = (row: number, letter: string) => {
    const idx = data?.columns.findIndex((c) => c.letter === letter) ?? -1;
    return data?.rows.find((r) => r.row === row)?.cells[idx] ?? "";
  };
  const openEditor = (row: number, col: string) => {
    const cell = `${col}${row}`;
    setEditing({ cell, row, col, field: columnFor(col)?.field, draft: cellValue(row, col) });
    setFocusCell(cell);
    requestAnimationFrame(() =>
      document.getElementById(`dc-${cell}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }),
    );
  };
  const saveEditor = () => {
    if (!editing) return;
    if (editing.draft === cellValue(editing.row, editing.col)) {
      setEditing(null);
      return;
    }
    void save(editing.row, editing.col, editing.draft);
  };

  const goToCell = (cell: string) => {
    setFocusCell(cell);
    document.getElementById(`dc-${cell}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  };

  if (loading) return <div className="glass-card p-6 text-sm">Running data check…</div>;
  if (!data) {
    return (
      <div className="glass-card p-6 text-sm">
        <p className="font-semibold">{error ?? "No workbook uploaded."}</p>
        <BackButton fallback="/" className="mt-2" />
      </div>
    );
  }

  const optionsFor = (field?: DataCheckField): string[] | null =>
    field === "station" ? data.options.station : field === "status" ? data.options.status : field === "category" ? data.options.category : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Check"
        subtitle={`Problems found in the "${data.sheetName}" sheet of ${data.fileName}. Fix them here; charts update immediately.`}
      />

      <section className="glass-card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="text-lg font-bold">{data.issues.length}</span>
        <span>{data.issues.length === 1 ? "issue" : "issues"}</span>
        {summary.map(([label, n]) => (
          <span key={label} className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600">
            {label}: {n}
          </span>
        ))}
        {data.acceptedIssues.length ? (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
            {data.acceptedIssues.length} accepted as is
          </span>
        ) : null}
        {data.overrides.length ? (
          <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-600">
            {data.overrides.length} {data.overrides.length === 1 ? "correction" : "corrections"} saved
          </span>
        ) : null}
        {READ_ONLY_CLIENT ? null : (<>
        <label className="ml-auto flex items-center gap-2 text-xs">
          Your name
          <input
            className="w-36 rounded border theme-border bg-transparent px-2 py-1 text-xs"
            placeholder="Unknown"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </label>
        <a
          href="/api/data/workbook/corrected"
          className=" rounded-md bg-[var(--brand-gold,#d4af37)] px-3 py-1.5 text-xs font-semibold text-slate-900 hover:opacity-90"
        >
          Download corrected Excel
        </a>
        </>)}
      </section>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(480px,560px)_1fr]">
        <section className="glass-card h-[calc(100vh-330px)] min-h-[360px] overflow-auto overscroll-contain p-0">
          <div className="sticky top-0 z-20 flex gap-1 border-b theme-border bg-[var(--card-bg,#fff)] p-2 text-xs">
            {(
              [
                ["issues", `Issues (${data.issues.length})`],
                ["accepted", `Accepted (${data.acceptedIssues.length})`],
                ["history", `History (${history.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "rounded px-3 py-1 font-medium",
                  tab === key ? "bg-sky-600 text-white" : "hover:bg-slate-500/15",
                )}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "issues" ? (
          <>
          <table className="data-table w-full text-xs">
            <thead className="sticky top-[45px] z-10 bg-[var(--card-bg,#fff)]">
              <tr>
                <th className="text-left">Cell</th>
                <th className="text-left">Field</th>
                <th className="text-left">Value</th>
                <th className="text-left">Problem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.issues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center theme-text-muted">
                    No issues found.
                  </td>
                </tr>
              ) : (
                data.issues.map((issue) => (
                  <tr
                    key={`${issue.cell}-${issue.field}`}
                    className={cn("cursor-pointer hover:bg-[var(--table-row-hover)]", focusCell === issue.cell && "bg-red-500/10")}
                    onClick={() => goToCell(issue.cell)}
                    title={`Row ${issue.row} (S.No ${issue.serialNo}), column ${issue.col} – ${issue.header}`}
                  >
                    <td className="whitespace-nowrap font-mono font-semibold">{issue.cell}</td>
                    <td className="whitespace-nowrap">{FIELD_LABELS[issue.field]}</td>
                    <td className="font-mono">{issue.value === "" ? <em className="theme-text-muted">blank</em> : issue.value}</td>
                    <td>{issue.problem}</td>
                    <td className="whitespace-nowrap text-right">
                      {READ_ONLY_CLIENT ? null : (<>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(issue.row, issue.col);
                        }}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        title="The value is genuine (e.g. a real NIL/NONE/blank). The issue stops counting; charts are unchanged."
                        className="ml-1 rounded border border-amber-500 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          void setAcceptance(issue.row, issue.col, true);
                        }}
                      >
                        Accept as is
                      </button>
                      </>)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {data.overrides.length ? (
            <div className="border-t theme-border p-3 text-xs">
              <p className="mb-2 font-semibold">Saved corrections</p>
              <ul className="space-y-1">
                {data.overrides.map((o) => (
                  <li key={`${o.col}${o.row}`} className="flex items-center gap-2">
                    <button type="button" className="font-mono underline" onClick={() => goToCell(`${o.col}${o.row}`)}>
                      {o.col}
                      {o.row}
                    </button>
                    <span>→ {o.value}</span>
                    {READ_ONLY_CLIENT ? null : <button
                      type="button"
                      disabled={saving}
                      className="ml-auto rounded px-2 py-0.5 text-red-600 hover:bg-red-500/10"
                      onClick={() => void save(o.row, o.col, null)}
                    >
                      Revert
                    </button>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          </>
          ) : tab === "accepted" ? (
            <table className="data-table w-full text-xs">
              <thead className="sticky top-[45px] z-10 bg-[var(--card-bg,#fff)]">
                <tr>
                  <th className="text-left">Cell</th>
                  <th className="text-left">Field</th>
                  <th className="text-left">Value</th>
                  <th className="text-left">Accepted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.acceptedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center theme-text-muted">
                      Nothing accepted yet. Use “Accept as is” for values that are genuinely NONE/NIL/blank.
                    </td>
                  </tr>
                ) : (
                  data.acceptedIssues.map((issue) => (
                    <tr key={`acc-${issue.cell}`} className="cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => goToCell(issue.cell)}>
                      <td className="whitespace-nowrap font-mono font-semibold">{issue.cell}</td>
                      <td className="whitespace-nowrap">{FIELD_LABELS[issue.field]}</td>
                      <td className="font-mono">{issue.value === "" ? <em className="theme-text-muted">blank</em> : issue.value}</td>
                      <td className="whitespace-nowrap">
                        {issue.acceptance.acceptedBy} · {formatIst(issue.acceptance.acceptedAt)}
                      </td>
                      <td className="text-right">
                        {READ_ONLY_CLIENT ? null : <button
                          type="button"
                          disabled={saving}
                          className="rounded px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void setAcceptance(issue.row, issue.col, false);
                          }}
                        >
                          Undo
                        </button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table w-full text-xs">
              <thead className="sticky top-[45px] z-10 bg-[var(--card-bg,#fff)]">
                <tr>
                  <th className="text-left">When (IST)</th>
                  <th className="text-left">Who</th>
                  <th className="text-left">Action</th>
                  <th className="text-left">Cell</th>
                  <th className="text-left">Old → New</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center theme-text-muted">
                      No changes yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h, i) => (
                    <tr key={`h-${i}-${h.at}`} title={h.field}>
                      <td className="whitespace-nowrap">{formatIst(h.at)}</td>
                      <td className="whitespace-nowrap">{h.by}</td>
                      <td className="whitespace-nowrap">{ACTION_LABEL[h.action]}</td>
                      <td className="whitespace-nowrap font-mono">
                        {h.cell} <span className="font-sans theme-text-muted">{h.field}</span>
                      </td>
                      <td className="font-mono">
                        {h.action === "save" || h.action === "revert"
                          ? `${h.oldValue || "(blank)"} → ${h.newValue || "(blank)"}`
                          : h.action === "upload"
                            ? `${h.oldValue ? `${h.oldValue} → ` : ""}${h.newValue}`
                            : h.action === "remove"
                              ? h.oldValue
                              : h.newValue || "(blank)"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>

        <div className="min-w-0 space-y-2">
        <p className="text-xs theme-text-secondary">
          {READ_ONLY_CLIENT ? "View only: the sheet can be read here but not changed." : <>Click <strong>Edit</strong> or double-click any cell to change it. Changes save instantly and update all charts.</>}
        </p>
        <section ref={gridRef} className="glass-card h-[calc(100vh-330px)] min-h-[360px] overflow-auto overscroll-contain p-0">
          <table className="border-collapse text-[11px]">
            <thead>
              <tr className="sticky top-0 z-20">
                <th className="sticky left-0 z-30 min-w-[44px] border theme-border bg-slate-200 px-1 text-center dark:bg-slate-800" />
                {data.columns.map((c) => (
                  <th key={c.letter} className="border theme-border bg-slate-200 px-2 text-center font-mono dark:bg-slate-800">
                    {c.letter}
                  </th>
                ))}
              </tr>
              <tr className="sticky top-[18px] z-20">
                <th className="sticky left-0 z-30 border theme-border bg-slate-100 px-1 text-center font-mono dark:bg-slate-900">
                  {data.headerRow}
                </th>
                {data.columns.map((c) => (
                  <th
                    key={c.letter}
                    className="max-w-[180px] truncate border theme-border bg-slate-100 px-2 text-left font-semibold dark:bg-slate-900"
                    title={c.header}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.row}>
                  <th className="sticky left-0 z-10 border theme-border bg-slate-100 px-1 text-center font-mono font-normal dark:bg-slate-900">
                    {r.row}
                  </th>
                  {data.columns.map((c, j) => {
                    const cell = `${c.letter}${r.row}`;
                    const problems = issuesByCell.get(cell);
                    const edited = overrideByCell.get(cell);
                    const accepted = acceptedByCell.get(cell);
                    const isEditing = editing?.cell === cell;
                    const value = r.cells[j] ?? "";
                    return (
                      <td
                        key={cell}
                        id={`dc-${cell}`}
                        title={
                          problems
                            ? `${problems.map((p) => p.problem).join("; ")} – double-click to edit`
                            : edited
                              ? `Corrected on ${new Date(edited.updatedAt).toLocaleString()} – double-click to edit`
                              : "Double-click to edit"
                        }
                        className={cn(
                          "group relative max-w-[180px] cursor-cell whitespace-nowrap border theme-border px-2 py-0.5 pr-5",
                          !isEditing && "truncate",
                          problems && "bg-red-500/25 text-red-900 dark:text-red-200",
                          edited && !problems && "bg-sky-500/20 text-sky-900 dark:text-sky-100",
                          accepted && !problems && !edited && "bg-amber-500/15",
                          focusCell === cell && "outline outline-2 outline-red-500",
                        )}
                        onClick={() => setFocusCell(cell)}
                        onDoubleClick={() => { if (!READ_ONLY_CLIENT) openEditor(r.row, c.letter); }}
                      >
                        {value}
                        {READ_ONLY_CLIENT ? null : !isEditing ? (
                          <button
                            type="button"
                            aria-label={`Edit ${cell}`}
                            className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-sky-600 hover:bg-sky-500/20 group-hover:block"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditor(r.row, c.letter);
                            }}
                          >
                            <Pencil size={11} />
                          </button>
                        ) : (
                          <CellEditor
                            edit={editing}
                            options={optionsFor(c.field)}
                            saving={saving}
                            onChange={(draft) => setEditing({ ...editing, draft })}
                            onSave={saveEditor}
                            onCancel={() => setEditing(null)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        </div>
      </div>
    </div>
  );
}
