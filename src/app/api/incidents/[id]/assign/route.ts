import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { addTimelineEvent, ensureObjectId, sendNotification, requireAuthedUser, visibilityFilter } from "@/app/api/incidents/helpers";
import { Incident } from "@/lib/db/models/Incident";
import { User } from "@/lib/db/models/User";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!["admin", "safety_head"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const body = await req.json();
  const investigatorId = ensureObjectId(String(body?.investigatorId ?? ""));
  if (!investigatorId) return NextResponse.json({ error: "investigatorId is required." }, { status: 400 });

  const [incident, investigator] = await Promise.all([
    Incident.findOne({ _id: incidentId, ...visibilityFilter(user) }),
    User.findById(investigatorId).lean(),
  ]);

  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  if (!investigator || !investigator.isActive) {
    return NextResponse.json({ error: "Investigator not found or inactive." }, { status: 404 });
  }

  if (!["investigator", "safety_head", "admin"].includes(investigator.role)) {
    return NextResponse.json({ error: "User role is not assignable as investigator." }, { status: 400 });
  }

  const oldValue = incident.assignedInvestigator ? new Types.ObjectId(incident.assignedInvestigator) : null;
  incident.assignedInvestigator = investigatorId;
  if (incident.status === "Open") incident.status = "In Progress";
  await incident.save();

  await addTimelineEvent({
    incidentId,
    eventType: "investigator_assigned",
    description: `Investigator assigned to ${investigator.name}`,
    performedBy: user._id,
    oldValue: { assignedInvestigator: oldValue },
    newValue: { assignedInvestigator: investigatorId },
  });

  await sendNotification({
    userId: investigatorId,
    type: "incident_assigned",
    title: `Incident ${incident.ghrNo} assigned`,
    message: `You have been assigned as investigator for incident ${incident.ghrNo}.`,
    incidentId,
  });

  return NextResponse.json({ incident });
}
