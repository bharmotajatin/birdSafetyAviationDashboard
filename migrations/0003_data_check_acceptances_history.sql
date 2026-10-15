-- PA-09b: "Accept as is" decisions for Data Check issues (apply only while the cell still holds `value`).
CREATE TABLE IF NOT EXISTS workbook_acceptances (
  row_number INTEGER NOT NULL,
  col TEXT NOT NULL,
  value TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  accepted_by TEXT NOT NULL,
  PRIMARY KEY (row_number, col)
);

-- PA-09b: audit trail of Data Check actions (times stored in UTC).
CREATE TABLE IF NOT EXISTS data_check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  cell TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  by_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_data_check_history_at ON data_check_history (at);