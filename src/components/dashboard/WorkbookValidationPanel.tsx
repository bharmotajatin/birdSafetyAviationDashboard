"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { WorkbookValidation } from "@/lib/validation/workbook";

type Props = {
  validation: WorkbookValidation;
  onLoadAnyway: () => void;
  onDismiss?: () => void;
  isLoading?: boolean;
};

export function WorkbookValidationPanel({
  validation,
  onLoadAnyway,
  onDismiss,
  isLoading = false,
}: Props) {
  const [open, setOpen] = useState(true);

  const totalIssues = validation.errorCount + validation.warningCount;

  return (
    <div className="mt-6 w-full text-left">
      {validation.missingSheets.length > 0 ? (
        <div role="alert" className="validation-alert-error mb-4 rounded-lg px-4 py-3 text-sm">
          <p className="validation-alert-title">Missing required worksheets</p>
          <p className="mt-1">
            The following sheets were not found:{" "}
            <span className="validation-alert-highlight">
              {validation.missingSheets.join(", ")}
            </span>
          </p>
        </div>
      ) : null}

      {validation.missingColumns.length > 0 ? (
        <div role="alert" className="validation-alert-error mb-4 rounded-lg px-4 py-3 text-sm">
          <p className="validation-alert-title">Missing Incident Log columns</p>
          <p className="mt-1">
            Header row is missing:{" "}
            <span className="validation-alert-highlight">
              {validation.missingColumns.join(", ")}
            </span>
          </p>
        </div>
      ) : null}

      <div className="validation-panel">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="validation-panel__toggle flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition"
        >
          <div>
            <p className="text-sm font-semibold theme-text">Validation results</p>
            <p className="validation-panel__summary mt-0.5 text-xs">
              <span className="validation-count-error">
                {validation.errorCount} error{validation.errorCount === 1 ? "" : "s"}
              </span>
              {" · "}
              <span className="validation-count-warning">
                {validation.warningCount} warning{validation.warningCount === 1 ? "" : "s"}
              </span>
              {" · "}
              {totalIssues} total for {validation.fileName}
            </p>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 theme-text-muted" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 theme-text-muted" aria-hidden />
          )}
        </button>

        {open ? (
          <div className="validation-table-scroll">
            <table className="validation-table w-full text-xs">
              <thead className="sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Sheet</th>
                  <th className="px-3 py-2 text-right font-semibold">Row</th>
                  <th className="px-3 py-2 text-left font-semibold">Column</th>
                  <th className="px-3 py-2 text-left font-semibold">GHR / S.No.</th>
                  <th className="px-3 py-2 text-left font-semibold">Issue</th>
                </tr>
              </thead>
              <tbody>
                {validation.issues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center theme-text-muted">
                      No row-level issues — structure checks only.
                    </td>
                  </tr>
                ) : (
                  validation.issues.map((issue, index) => (
                    <tr
                      key={`${issue.sheet}-${issue.row}-${issue.column}-${index}`}
                      className={
                        issue.severity === "error"
                          ? "validation-row-error"
                          : "validation-row-warning"
                      }
                    >
                      <td className="px-3 py-2">{issue.sheet}</td>
                      <td className="px-3 py-2 text-right">{issue.row ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{issue.column}</td>
                      <td className="px-3 py-2">{issue.rowRef}</td>
                      <td className="px-3 py-2">{issue.issue}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="validation-panel__footer flex flex-wrap items-center justify-end gap-2 px-4 py-3">
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="validation-btn-cancel rounded-lg px-3 py-1.5 text-xs font-medium transition"
            >
              Cancel
            </button>
          ) : null}
          {validation.errorCount > 0 ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadAnyway}
              className="validation-btn-load-anyway rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-50"
            >
              {isLoading ? "Loading…" : "Load Anyway"}
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadAnyway}
              className="validation-btn-continue rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-50"
            >
              {isLoading ? "Loading…" : "Continue to dashboard"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
