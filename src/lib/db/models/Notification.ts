import { Model, Schema, Types, model, models } from "mongoose";

export interface INotification {
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  incidentId?: Types.ObjectId | null;
  isRead: boolean;
  sentAt: Date;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type NotificationModel = Model<INotification>;

const NotificationSchema = new Schema<INotification, NotificationModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", default: null, index: true },
    isRead: { type: Boolean, default: false, index: true },
    sentAt: { type: Date, default: Date.now, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: 1, sentAt: -1 });
NotificationSchema.index({ incidentId: 1, sentAt: -1 });

export const Notification =
  (models.Notification as NotificationModel) ||
  model<INotification, NotificationModel>("Notification", NotificationSchema);
