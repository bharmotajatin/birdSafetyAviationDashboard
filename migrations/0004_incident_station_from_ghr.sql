-- Station taken from the GHR no. prefix because the sheet's station cell was empty (source data unchanged).
ALTER TABLE incidents ADD COLUMN station_from_ghr INTEGER NOT NULL DEFAULT 0;
