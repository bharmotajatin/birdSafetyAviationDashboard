# Data drop folder

Place Excel workbooks here (same format as `DEL_INCIDENT_FIXED.xlsx`).

In **development** (`npm run dev`), the server watches this folder and pushes updates to the dashboard via Server-Sent Events.

New incident rows are merged by **GHR No.** + **S.No.** (duplicates are skipped).
