import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { parseWorkbookParts } from "../src/lib/parse";
import { Department } from "../src/lib/db/models/Department";
import { Incident, type IncidentCategory, type IncidentType } from "../src/lib/db/models/Incident";
import { Station } from "../src/lib/db/models/Station";
import { User } from "../src/lib/db/models/User";

loadEnvConfig(process.cwd());

const DEFAULT_INCIDENT_TYPE: IncidentType = "Other";
const DEFAULT_CATEGORY: IncidentCategory = "CAT-D";

function toIncidentType(value: string): IncidentType {
  const candidate = value?.trim();
  const allowed: IncidentType[] = [
    "Staff Injury",
    "Near Miss",
    "A/C Damage",
    "GSE Incident",
    "Loading Error",
    "Slip/Trip",
    "ULD Damage",
    "Cargo Hold Damage",
    "Aircraft Related",
    "Communication Failure",
    "Pallet Tilted",
    "Airport Property Damaged",
    "GSE Collision",
    "Other",
  ];
  return allowed.includes(candidate as IncidentType) ? (candidate as IncidentType) : DEFAULT_INCIDENT_TYPE;
}

function toIncidentCategory(value: string): IncidentCategory {
  if (value === "CAT-A" || value === "CAT-B" || value === "CAT-C" || value === "CAT-D") return value;
  return DEFAULT_CATEGORY;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error("Usage: npm run import-excel -- <path-to-xlsx>");
  }

  const fullPath = path.resolve(process.cwd(), fileArg);
  const buffer = readFileSync(fullPath);
  const workbook = parseWorkbookParts(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing in .env.local");
  await mongoose.connect(uri, { bufferCommands: false });

  const adminUser = await User.findOne({ role: "admin", isActive: true }).lean();
  if (!adminUser?._id) throw new Error("No active admin user found. Run seed first.");

  const stationMap = new Map<string, string>();
  for (const station of await Station.find().lean()) {
    stationMap.set(station.code, String(station._id));
  }

  const deptMap = new Map<string, string>();
  for (const dept of await Department.find().lean()) {
    deptMap.set(dept.code, String(dept._id));
  }

  let imported = 0;
  let skipped = 0;

  for (const incident of workbook.incidents) {
    const stationId = stationMap.get(incident.station as string);
    const deptId = deptMap.get(incident.department);
    if (!stationId || !deptId) {
      skipped += 1;
      continue;
    }

    const existing = await Incident.findOne({ ghrNo: incident.ghrNumber }).select("_id").lean();
    if (existing) {
      skipped += 1;
      continue;
    }

    await Incident.create({
      ghrNo: incident.ghrNumber,
      serialNo: incident.serialNo,
      incidentTitle: incident.title || "Imported incident",
      dateOfIncident: incident.date ?? new Date(),
      timeOfIncident: incident.time || "",
      location: { text: incident.location || "Unknown" },
      station: stationId,
      department: deptId,
      operationalPhase: "Other",
      incidentType: toIncidentType(incident.incidentType),
      incidentCategory: toIncidentCategory(incident.category),
      status: incident.status === "Closed" ? "Closed" : "Open",
      incidentBrief: incident.brief || "",
      personInvolved: { name: incident.personInvolved || "" },
      injuryDetails: { bodyPart: "", severity: "", treatment: "" },
      rootCause: incident.rootCause || "",
      correctiveAction: incident.correctiveAction || "",
      equipmentInvolved: incident.equipment || "",
      createdBy: adminUser._id,
      attachments: [],
    });
    imported += 1;
  }

  console.log(`Excel import complete. Imported: ${imported}, skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
