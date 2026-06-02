import bcrypt from "bcryptjs";
import { Model, Schema, Types, model, models } from "mongoose";

export const USER_ROLES = [
  "admin",
  "safety_head",
  "investigator",
  "duty_manager",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  station?: Types.ObjectId | null;
  department?: Types.ObjectId | null;
  employeeId?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, default: "viewer" },
    station: { type: Schema.Types.ObjectId, ref: "Station", default: null },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    employeeId: { type: String, trim: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.method("comparePassword", async function comparePassword(candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1, station: 1 });
UserSchema.index({ isActive: 1, updatedAt: -1 });

export const User = (models.User as UserModel) || model<IUser, UserModel>("User", UserSchema);
