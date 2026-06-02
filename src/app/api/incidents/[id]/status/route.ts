import { NextRequest, NextResponse } from "next/server";
import { addTimelineEvent, ensureObjectId, sendNotification, requireAuthedUser, visibilityFilter } from "@/app/api/incidents/helpers";
import { Incident, type IncidentStatus } from "@/lib/db/models/Incident";

type RouteCtx = { params: Promise<{ id: string }> };

const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  Open: ["In Progress"],
  "In Progress": ["Pending", "Rejected"],
  Pending: ["Closed", "In Progress", "Rejected"],
  Closed: [],
  Reviewed: [],
  Rejected: ["In Progress"],
};

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const incident = await Incident.findOne({ _id: incidentId, ...visibilityFilter(user) });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const body = await req.json();
  const newStatus = String(body?.newStatus ?? "") as IncidentStatus;
  const note = String(body?.note ?? "").trim();
  if (!newStatus || !note) {
    return NextResponse.json({ error: "newStatus and note are required." }, { status: 400 });
  }

  if (!TRANSITIONS[incident.status as IncidentStatus]?.includes(newStatus)) {
    return NextResponse.json({ error: `Invalid status transition from ${incident.status} to ${newStatus}` }, { status: 400 });
  }

  if (["Closed", "Rejected"].includes(newStatus) && user.role !== "safety_head" && user.role !== "admin") {
    return NextResponse.json({ error: "Only safety_head or admin can close/reject incidents." }, { status: 403 });
  }

  const oldStatus = incident.status;
  incident.status = newStatus;
  if (newStatus === "Closed") {
    incident.closedAt = new Date();
    incident.closedBy = user._id;
  }
  await incident.save();

  await addTimelineEvent({
    incidentId,
    eventType: "status_changed",
    description: note,
    performedBy: user._id,
    oldValue: { status: oldStatus },
    newValue: { status: newStatus },
  });

  if (incident.createdBy) {
    await sendNotification({
      userId: incident.createdBy,
      type: "incident_status_updated",
      title: `Incident ${incident.ghrNo} status changed`,
      message: `${oldStatus} → ${newStatus}. Note: ${note}`,
      incidentId,
    });
  }

  return NextResponse.json({ incident });
}
