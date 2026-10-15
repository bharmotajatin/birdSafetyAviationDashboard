import { ensureUniqueIncidentIds, parseIncidentLog } from "../parse/incidents";
import type { Incident } from "../types";
import { buildAnalysisModel, type AnalysisModel } from "./model";
import { findHeaderRowIndex, findPersonalColumns, maskPersonalData, type PersonalColumn } from "./privacy";

export type PreparedAnalysis = {
  incidents: Incident[];
  model: AnalysisModel;
  /** Matrix written to the Log sheet (already masked when hidePersonal is on). */
  sourceRows: unknown[][];
  personalColumns: PersonalColumn[];
  hidePersonal: boolean;
};

/** PA-14: parse (optionally masked) incident-log rows and build the export model from them. */
export function prepareAnalysis(sheet: { name: string; rows: unknown[][] }, hidePersonal: boolean): PreparedAnalysis {
  const masked = hidePersonal ? maskPersonalData(sheet.rows) : null;
  const rows = masked ? masked.rows : sheet.rows;
  const personalColumns = masked?.columns ?? findPersonalColumns(sheet.rows[findHeaderRowIndex(sheet.rows)] ?? []);
  const incidents = ensureUniqueIncidentIds(parseIncidentLog([{ name: sheet.name, rows }]));
  const model = buildAnalysisModel(incidents, { sourceRows: rows, personalColumns });
  return { incidents, model, sourceRows: rows, personalColumns, hidePersonal };
}
