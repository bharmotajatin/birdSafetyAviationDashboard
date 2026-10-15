# Auditor notes: Pattern Analysis data and saving (2026-10-15 IST)

Builds on TESTER_REPORT_PATTERN_ANALYSIS.md (PA-01..PA-06).

## Saving: works, with gaps
- Upload goes to POST /api/data/workbook -> parse -> saveWorkbook. Deployed: Cloudflare D1 table `incidents` + `workbook`. Local: `.data/workbook.json`. Data stays until DELETE (Remove sheet). Requirement "keep data until sheet removed" is met in design.
- AU-01 (major): Save is not atomic. "DELETE FROM incidents" runs in the first batch of 40, the inserts run in later batches. If a later batch fails, D1 is left with partial or no data. Fix: write to a staging table/import_id and swap, or put delete + inserts in one db.batch.
- AU-02 (major): Incidents are stored already normalised. After PA-01..03 are fixed, the stored data is still wrong until the sheet is re-uploaded. Fix: add a "re-parse stored workbook" step (needs original bytes, see AU-03) or ask user to re-upload once after deploy.
- AU-03 (minor): wrangler.jsonc has no R2 binding `WORKBOOKS`, so the original file is not kept in production (only parsed rows). Add the R2 bucket binding if re-parse or download is wanted.
- AU-04 (minor): A second copy lives in browser localStorage (bfs-storage.ts, capped at 500 rows). Two sources can disagree; server should be the single source, localStorage cache only.
- AU-05 (minor): D1 schema columns category/status may hold "Unknown" after PA-02/03; check migrations allow it and charts have an Unknown bucket.

## Order of work
1. DEVELOPER: PA-01..03, then AU-01, AU-02, then PA-04..06.
2. DESIGNER: show "Unknown/Not set" buckets clearly; merge repeated graphs once TESTER lists them.
3. TESTER: retest with the same sheet, reload page, confirm counts persist; then Remove sheet and confirm empty.
