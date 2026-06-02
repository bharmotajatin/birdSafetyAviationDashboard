import { Model, Schema, Types, model, models } from "mongoose";

export interface IAttachment {
  incidentId: Types.ObjectId;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type AttachmentModel = Model<IAttachment>;

const AttachmentSchema = new Schema<IAttachment, AttachmentModel>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    filename: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

AttachmentSchema.index({ incidentId: 1, createdAt: -1 });
AttachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
AttachmentSchema.index({ mimeType: 1 });

export const Attachment =
  (models.Attachment as AttachmentModel) || model<IAttachment, AttachmentModel>("Attachment", AttachmentSchema);
