# Tester report: Pattern Analysis graphs vs uploaded incident sheet (2026-10-15 IST)

Sheet: Incident Log, 101 data rows, header on row 3. App: http://localhost:3001/pattern-analysis (D:\birdSafetyAviationDashboard).

## Confirmed wrong data
| ID | Severity | Graph affected | Cause | Real values in sheet |
|----|----------|----------------|-------|----------------------|
| PA-01 | blocker | Station / location hotspot charts | Station column (col 54) has no header, so the parser finds no station and `normalizeStation(... || "DEL")` puts every incident in DEL (`src/lib/parse/incidents.ts`) | COK 29, BLR 29, DEL 23, MAA 6, TRV 4, HYD 3, 11 blank |
| PA-02 | major | Category (CAT-A to D) charts | `normalizeCategory` turns blank and "NIL" into CAT-D (`src/lib/parse/utils.ts`) | CAT-C 45, CAT-D 41, CAT-B 4, CAT-A 2, NIL 2, blank ~7 |
| PA-03 | major | Status / closure charts | `normalizeStatus` turns blank into Closed | Closed 80, In Progress 10, Pending 5, blank ~6 |
| PA-04 | minor | Incident type chart | Multi-value cells ("GSE Damage; Collision/Impact") and "NONE" become their own bars | split or map to Unknown |
| PA-05 | minor | Department chart | "RAMP; GSD" is counted only as RAMP | count both or show combined |
| PA-06 | minor | Equipment details | alias "equipment" prefix-matches "Equipment No." instead of "GSE / Equipment Type" | |

Fix: detect the station column by values (3-letter codes) or add a header in the template; show blanks as "Unknown"/"Not set" instead of defaulting. Retest: upload the same sheet and compare chart totals with the table above.

## Still to do
- Full list of repeated graphs on the page (needs the rendered page walk).
