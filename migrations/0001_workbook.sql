CREATE TABLE IF NOT EXISTS workbook (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  serial_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  ghr_number TEXT NOT NULL,
  occurred_on TEXT,
  date_label TEXT NOT NULL,
  category TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT NOT NULL,
  station TEXT NOT NULL,
  brief TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  immediate_action TEXT NOT NULL,
  location TEXT NOT NULL,
  time_label TEXT NOT NULL,
  person_involved TEXT NOT NULL,
  equipment TEXT NOT NULL,
  contributing_factor TEXT NOT NULL,
  month_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_station ON incidents (station);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents (category);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_month ON incidents (month_key);
