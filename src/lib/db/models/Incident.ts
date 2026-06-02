import { Model, Schema, Types, model, models } from "mongoose";

export const OPERATIONAL_PHASES = [
  "Pre-Arrival",
  "Arrival",
  "Turnaround",
  "Loading/Unloading",
  "Pushback",
  "Taxi-Out",
  "Other",
] as const;

export const INCIDENT_TYPES = [
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
] as const;

export const INCIDENT_CATEGORIES = ["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as const;
export const INCIDENT_STATUSES = [
  "Open",
  "In Progress",
  "Pending",
  "Closed",
  "Reviewed",
  "Rejected",
] as const;

export type OperationalPhase = (typeof OPERATIONAL_PHASES)[number];
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IIncidentLocation {
  text: string;
  bay?: string;
  gate?: string;
  zone?: string;
}

export interface IIncidentPersonInvolved {
  name?: string;
  designation?: string;
  staffNo?: string;
  age?: number;
  gender?: string;
}

export interface IIncidentInjuryDetails {
  bodyPart?: string;
  severity?: string;
  treatment?: string;
}

export interface IIncident {
  ghrNo: string;
  serialNo: number;
  incidentTitle: string;
  dateOfIncident: Date;
  timeOfIncident?: string;
  dateReported?: Date;
  location: IIncidentLocation;
  station: Types.ObjectId;
  department: Types.ObjectId;
  operationalPhase: OperationalPhase;
  incidentType: IncidentType;
  incidentCategory: IncidentCategory;
  status: IncidentStatus;
  incidentBrief: string;
  personInvolved: IIncidentPersonInvolved;
  injuryDetails: IIncidentInjuryDetails;
  weatherConditions?: string;
  equipmentInvolved?: string;
  immediateAction?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  investigationNotes?: string;
  attachments: Types.ObjectId[];
  createdBy: Types.ObjectId;
  assignedInvestigator?: Types.ObjectId | null;
  reviewedBy?: Types.ObjectId | null;
  closedBy?: Types.ObjectId | null;
  closedAt?: Date | null;
  reopenedCount: number;
  slaDeadline?: Date | null;
  isOverdueSLA: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type IncidentModel = Model<IIncident>;

const IncidentSchema = new Schema<IIncident, IncidentModel>(
  {
    ghrNo: { type: String, unique: true, index: true },
    serialNo: { type: Number, index: true },
    incidentTitle: { type: String, required: true, trim: true },
    dateOfIncident: { type: Date, required: true },
    timeOfIncident: { type: String, default: "" },
    dateReported: { type: Date, default: null },
    location: {
      text: { type: String, required: true, trim: true },
      bay: { type: String, default: "" },
      gate: { type: String, default: "" },
      zone: { type: String, default: "" },
    },
    station: { type: Schema.Types.ObjectId, ref: "Station", required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    operationalPhase: { type: String, enum: OPERATIONAL_PHASES, required: true },
    incidentType: { type: String, enum: INCIDENT_TYPES, required: true, index: true },
    incidentCategory: { type: String, enum: INCIDENT_CATEGORIES, required: true, index: true },
    status: { type: String, enum: INCIDENT_STATUSES, required: true, default: "Open", index: true },
    incidentBrief: { type: String, required: true },
    personInvolved: {
      name: { type: String, default: "" },
      designation: { type: String, default: "" },
      staffNo: { type: String, default: "" },
      age: { type: Number, default: null },
      gender: { type: String, default: "" },
    },
    injuryDetails: {
      bodyPart: { type: String, default: "" },
      severity: { type: String, default: "" },
      treatment: { type: String, default: "" },
    },
    weatherConditions: { type: String, default: "" },
    equipmentInvolved: { type: String, default: "" },
    immediateAction: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    correctiveAction: { type: String, default: "" },
    preventiveAction: { type: String, default: "" },
    investigationNotes: { type: String, default: "" },
    attachments: [{ type: Schema.Types.ObjectId, ref: "Attachment" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedInvestigator: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    reopenedCount: { type: Number, default: 0, min: 0 },
    slaDeadline: { type: Date, default: null, index: true },
    isOverdueSLA: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

IncidentSchema.pre("validate", async function autoGenerateIds() {
  if (!this.ghrNo || !this.serialNo) {
    const currentYear = new Date().getFullYear();
    const count = await Incident.countDocuments({
      createdAt: {
        $gte: new Date(currentYear, 0, 1),
        $lt: new Date(currentYear + 1, 0, 1),
      },
    });
    const nextSerial = count + 1;
    if (!this.serialNo) this.serialNo = nextSerial;
    if (!this.ghrNo) {
      this.ghrNo = `GHR-${currentYear}-${String(nextSerial).padStart(4, "0")}`;
    }
  }

  if (this.slaDeadline && !["Closed", "Reviewed", "Rejected"].includes(this.status)) {
    this.isOverdueSLA = this.slaDeadline.getTime() < Date.now();
  } else {
    this.isOverdueSLA = false;
  }
});

IncidentSchema.index({ ghrNo: 1 }, { unique: true });
IncidentSchema.index({ station: 1, dateOfIncident: -1 });
IncidentSchema.index({ department: 1, dateOfIncident: -1 });
IncidentSchema.index({ status: 1, incidentCategory: 1, updatedAt: -1 });
IncidentSchema.index({ incidentType: 1, dateOfIncident: -1 });
IncidentSchema.index({ assignedInvestigator: 1, status: 1, slaDeadline: 1 });
IncidentSchema.index({ createdAt: -1 });
IncidentSchema.index({ isDeleted: 1, updatedAt: -1 });

export const Incident =
  (models.Incident as IncidentModel) || model<IIncident, IncidentModel>("Incident", IncidentSchema);
