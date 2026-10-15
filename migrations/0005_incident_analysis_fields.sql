-- Extra incident fields for analyses (reporting delay, repeats, shift).
ALTER TABLE incidents ADD COLUMN report_date TEXT NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN shift_timing TEXT NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN staff_no TEXT NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN equipment_no TEXT NOT NULL DEFAULT '';
