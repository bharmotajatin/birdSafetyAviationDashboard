-- PA-09: user corrections to the uploaded Incident Log, keyed by Excel row number + column letter.
CREATE TABLE IF NOT EXISTS workbook_overrides (
  row_number INTEGER NOT NULL,
  col TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (row_number, col)
);

-- Original uploaded workbook (base64) so corrections can be re-applied and the corrected file
-- downloaded even when no R2 bucket is bound.
CREATE TABLE IF NOT EXISTS workbook_file (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bytes_b64 TEXT NOT NULL
);