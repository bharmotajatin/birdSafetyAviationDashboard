import { Model, Schema, Types, model, models } from "mongoose";

export const ACTIVITY_TYPES = ["login", "admin_action", "system_error"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface IActivityLog {
  type: ActivityType;
  action: string;
  message: string;
  actorUserId?: Types.ObjectId | null;
  targetUserId?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type ActivityLogModel = Model<IActivityLog>;

const ActivityLogSchema = new Schema<IActivityLog, ActivityLogModel>(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ type: 1, createdAt: -1 });

export const ActivityLog =
  (models.ActivityLog as ActivityLogModel) ||
  model<IActivityLog, ActivityLogModel>("ActivityLog", ActivityLogSchema);
