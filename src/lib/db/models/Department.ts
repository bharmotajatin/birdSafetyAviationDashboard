import { Model, Schema, model, models } from "mongoose";

export interface IDepartment {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type DepartmentModel = Model<IDepartment>;

const DepartmentSchema = new Schema<IDepartment, DepartmentModel>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

DepartmentSchema.index({ code: 1 }, { unique: true });
DepartmentSchema.index({ isActive: 1, name: 1 });

export const Department =
  (models.Department as DepartmentModel) || model<IDepartment, DepartmentModel>("Department", DepartmentSchema);
