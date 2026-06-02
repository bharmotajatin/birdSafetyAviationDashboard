import { Model, Schema, Types, model, models } from "mongoose";

export const TIMELINE_EVENT_TYPES = [
  "created",
  "briefing_added",
  "photo_uploaded",
  "status_changed",
  "investigator_assigned",
  "note_added",
  "review_requested",
  "approved",
  "rejected",
  "closed",
  "reopened",
  "comment",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export interface ITimelineEvent {
  incidentId: Types.ObjectId;
  eventType: TimelineEventType;
  description: string;
  performedBy: Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

type TimelineEventModel = Model<ITimelineEvent>;

const TimelineEventSchema = new Schema<ITimelineEvent, TimelineEventModel>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    eventType: { type: String, enum: TIMELINE_EVENT_TYPES, required: true, index: true },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

TimelineEventSchema.index({ incidentId: 1, createdAt: -1 });
TimelineEventSchema.index({ eventType: 1, createdAt: -1 });

export const TimelineEvent =
  (models.TimelineEvent as TimelineEventModel) ||
  model<ITimelineEvent, TimelineEventModel>("TimelineEvent", TimelineEventSchema);
