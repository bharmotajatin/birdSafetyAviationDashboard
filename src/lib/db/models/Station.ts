import { Model, Schema, Types, model, models } from "mongoose";

export interface IStation {
  code: string;
  name: string;
  fullName: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone: string;
  isActive: boolean;
  safetyHeadUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

type StationModel = Model<IStation>;

export const BFS_STATION_SEED: Array<Pick<IStation, "code" | "name" | "fullName" | "timezone">> = [
  { code: "CJB", name: "CJB", fullName: "Coimbatore", timezone: "Asia/Kolkata" },
  { code: "COK", name: "COK", fullName: "Kochi", timezone: "Asia/Kolkata" },
  { code: "DEL", name: "DEL", fullName: "Delhi", timezone: "Asia/Kolkata" },
  { code: "GOI", name: "GOI", fullName: "Goa", timezone: "Asia/Kolkata" },
  { code: "HYD", name: "HYD", fullName: "Hyderabad", timezone: "Asia/Kolkata" },
  { code: "IMF", name: "IMF", fullName: "Imphal", timezone: "Asia/Kolkata" },
  { code: "IXA", name: "IXA", fullName: "Agartala", timezone: "Asia/Kolkata" },
  { code: "IXC", name: "IXC", fullName: "Chandigarh", timezone: "Asia/Kolkata" },
  { code: "MAA", name: "MAA", fullName: "Chennai", timezone: "Asia/Kolkata" },
  { code: "TRV", name: "TRV", fullName: "Thiruvananthapuram", timezone: "Asia/Kolkata" },
  { code: "TRZ", name: "TRZ", fullName: "Tiruchirappalli", timezone: "Asia/Kolkata" },
];

const StationSchema = new Schema<IStation, StationModel>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    isActive: { type: Boolean, default: true },
    safetyHeadUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

StationSchema.index({ code: 1 }, { unique: true });
StationSchema.index({ isActive: 1, name: 1 });
StationSchema.index({ safetyHeadUserId: 1 }, { sparse: true });

export const Station = (models.Station as StationModel) || model<IStation, StationModel>("Station", StationSchema);
