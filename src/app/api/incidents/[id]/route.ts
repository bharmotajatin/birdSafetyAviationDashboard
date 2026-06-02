import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { addTimelineEvent, ensureObjectId, isRoleAtLeast, requireAuthedUser, visibilityFilter } from "@/app/api/incidents/helpers";
import { Incident } from "@/lib/db/models/Incident";
import { TimelineEvent } from "@/lib/db/models/TimelineEvent";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const query = { _id: incidentId, ...visibilityFilter(user) };
  const incident = await Incident.findOne(query)
    .populate("createdBy", "name email role")
    .populate("assignedInvestigator", "name email role")
    .populate("attachments")
    .lean();

  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const timeline = await TimelineEvent.find({ incidentId }).sort({ createdAt: 1 }).populate("performedBy", "name email role").lean();
  return NextResponse.json({ incident, timeline });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const incident = await Incident.findOne({ _id: incidentId, ...visibilityFilter(user) });
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const body = await req.json();
  const changes: Record<string, unknown> = {};

  if (user.role === "duty_manager") {
    if (String(incident.createdBy) !== String(user._id) || incident.status !== "Open") {
      return NextResponse.json({ error: "Duty manager can edit only own open incidents." }, { status: 403 });
    }
    const editable = [
      "incidentTitle",
      "dateOfIncident",
      "timeOfIncident",
      "location",
      "incidentBrief",
      "personInvolved",
      "injuryDetails",
      "weatherConditions",
      "equipmentInvolved",
      "immediateAction",
    ] as const;
    editable.forEach((key) => {
      if (body[key] !== undefined) changes[key] = body[key];
    });
  } else if (user.role === "investigator") {
    if (String(incident.assignedInvestigator) !== String(user._id)) {
      return NextResponse.json({ error: "Investigator can edit only assigned incidents." }, { status: 403 });
    }
    if (body.investigationNotes !== undefined) changes.investigationNotes = String(body.investigationNotes);
    if (body.rootCause !== undefined) changes.rootCause = String(body.rootCause);
    if (body.correctiveAction !== undefined) changes.correctiveAction = String(body.correctiveAction);
    if (body.preventiveAction !== undefined) changes.preventiveAction = String(body.preventiveAction);
    if (body.attachments !== undefined && Array.isArray(body.attachments)) changes.attachments = body.attachments;
  } else if (isRoleAtLeast(user.role, "safety_head")) {
    if (body.status !== undefined) changes.status = String(body.status);
    if (body.reviewedBy !== undefined && Types.ObjectId.isValid(body.reviewedBy)) {
      changes.reviewedBy = new Types.ObjectId(body.reviewedBy);
    }
    if (body.closedBy !== undefined && Types.ObjectId.isValid(body.closedBy)) {
      changes.closedBy = new Types.ObjectId(body.closedBy);
    }
    if (body.investigationNotes !== undefined) changes.investigationNotes = String(body.investigationNotes);
    if (body.rootCause !== undefined) changes.rootCause = String(body.rootCause);
    if (body.correctiveAction !== undefined) changes.correctiveAction = String(body.correctiveAction);
    if (body.preventiveAction !== undefined) changes.preventiveAction = String(body.preventiveAction);
    if (body.attachments !== undefined && Array.isArray(body.attachments)) changes.attachments = body.attachments;
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!Object.keys(changes).length) {
    return NextResponse.json({ error: "No allowed fields to update." }, { status: 400 });
  }

  const oldSnapshot = incident.toObject();
  Object.entries(changes).forEach(([key, value]) => {
    (incident as any)[key] = value;
  });
  await incident.save();

  await addTimelineEvent({
    incidentId,
    eventType: "note_added",
    description: "Incident fields updated",
    performedBy: user._id,
    oldValue: oldSnapshot,
    newValue: changes,
  });

  return NextResponse.json({ incident });
}

export async function DELETE(_: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const incidentId = ensureObjectId(id);
  if (!incidentId) return NextResponse.json({ error: "Invalid incident id" }, { status: 400 });

  const incident = await Incident.findById(incidentId);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  incident.isDeleted = true;
  incident.deletedAt = new Date();
  await incident.save();

  await addTimelineEvent({
    incidentId,
    eventType: "comment",
    description: "Incident soft deleted by admin",
    performedBy: user._id,
    newValue: { isDeleted: true },
  });

  return NextResponse.json({ success: true });
}
