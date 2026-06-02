import { Model, Schema, Types, model, models } from "mongoose";

export interface ISettings {
  key: string;
  value: unknown;
  description?: string;
  updatedBy?: Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

type SettingsModel = Model<ISettings>;

const SettingsSchema = new Schema<ISettings, SettingsModel>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true },
);

SettingsSchema.index({ key: 1 }, { unique: true });
SettingsSchema.index({ updatedAt: -1 });

export const Settings =
  (models.Settings as SettingsModel) || model<ISettings, SettingsModel>("Settings", SettingsSchema);
