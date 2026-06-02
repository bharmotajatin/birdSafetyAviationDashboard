import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import { Incident, type IIncident, INCIDENT_STATUSES } from "@/lib/db/models/Incident";
import { Notification } from "@/lib/db/models/Notification";
import { Settings } from "@/lib/db/models/Settings";
import { Station } from "@/lib/db/models/Station";
import { TimelineEvent } from "@/lib/db/models/TimelineEvent";
import { User, type UserRole } from "@/lib/db/models/User";

type CurrentUserDoc = Awaited<ReturnType<typeof getCurrentUser>>;

export type AuthedUser = NonNullable<CurrentUserDoc> & { _id: Types.ObjectId };

export function isRoleAtLeast(role: UserRole, threshold: UserRole): boolean {
  const rank: Record<UserRole, number> = {
    viewer: 0,
    investigator: 1,
    duty_manager: 2,
    safety_head: 3,
    admin: 4,
  };
  return rank[role] >= rank[threshold];
}

export async function requireAuthedUser() {
  await dbConnect();
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), user: null };
  }
  return { user: user as AuthedUser };
}

export function visibilityFilter(user: AuthedUser): Record<string, unknown> {
  if (user.role === "admin") return { isDeleted: { $ne: true } };
  if (user.role === "safety_head") return { station: user.station, isDeleted: { $ne: true } };
  if (user.role === "investigator") return { assignedInvestigator: user._id, isDeleted: { $ne: true } };
  if (user.role === "duty_manager") return { createdBy: user._id, isDeleted: { $ne: true } };
  return { createdBy: user._id, isDeleted: { $ne: true } };
}

export function ensureObjectId(id: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

export function parseDateRange(from: string | null, to: string | null) {
  const range: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) range.$lte = d;
  }
  return Object.keys(range).length ? range : null;
}

export async function computeGhrNo(stationId: Types.ObjectId) {
  const station = await Station.findById(stationId).lean();
  if (!station) throw new Error("Station not found");

  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await Incident.countDocuments({
    station: station._id,
    createdAt: { $gte: start, $lt: end },
  });
  const serial = count + 1;
  const ghrNo = `${station.code}${year}/${String(serial).padStart(4, "0")}`;
  return { ghrNo, serialNo: serial, stationCode: station.code };
}

export async function getSlaHours(category: string) {
  const settings = await Settings.findOne({ key: "sla.hoursByCategory" }).lean();
  const map = (settings?.value as Record<string, number> | undefined) ?? {};
  return Number(map[category]) || 24;
}

export function validateStatus(value: string): value is (typeof INCIDENT_STATUSES)[number] {
  return (INCIDENT_STATUSES as readonly string[]).includes(value);
}

export async function addTimelineEvent(params: {
  incidentId: Types.ObjectId;
  eventType:
    | "created"
    | "briefing_added"
    | "photo_uploaded"
    | "status_changed"
    | "investigator_assigned"
    | "note_added"
    | "review_requested"
    | "approved"
    | "rejected"
    | "closed"
    | "reopened"
    | "comment";
  description: string;
  performedBy: Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await TimelineEvent.create(params);
}

export async function sendNotification(params: {
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  incidentId?: Types.ObjectId;
}) {
  await Notification.create({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    incidentId: params.incidentId ?? null,
  });
}

export async function notifyStationSafetyHead(stationId: Types.ObjectId, incidentId: Types.ObjectId, ghrNo: string) {
  const station = await Station.findById(stationId).lean();
  if (!station?.safetyHeadUserId) return;

  await sendNotification({
    userId: station.safetyHeadUserId,
    type: "incident_created",
    title: `New incident created (${ghrNo})`,
    message: "A new incident has been created and requires safety head visibility.",
    incidentId,
  });
}

export async function getUserById(userId: Types.ObjectId) {
  return User.findById(userId).lean();
}
