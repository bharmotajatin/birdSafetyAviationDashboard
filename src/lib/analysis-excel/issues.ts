import { partitionIssues, type CellAcceptance, type DataCheckIssue } from "../data-check";

/**
 * PA-13: Step 1 must show the same open issues as Data Check, so issues the team already
 * accepted there (same cell and same value) are left out of the uploaded file's issues.
 */
export function acceptancesFromCheck(check: { acceptedIssues?: { acceptance?: CellAcceptance }[] } | null | undefined): CellAcceptance[] {
  return (check?.acceptedIssues ?? []).map((a) => a.acceptance).filter((a): a is CellAcceptance => Boolean(a));
}

export function openUploadIssues(issues: DataCheckIssue[], acceptances: CellAcceptance[]): DataCheckIssue[] {
  return partitionIssues(issues, acceptances).open;
}
