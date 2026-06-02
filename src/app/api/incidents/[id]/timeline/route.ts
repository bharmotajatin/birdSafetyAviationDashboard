import { NextRequest, NextResponse } from "next/server";
import { ensureObjectId, requireAuthedUser, visibilityFilter } from "@/app/api/incidents/helpers";
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

  const incident = await Incident.findOne({ _id: incidentId, ...visibilityFilter(user) }).select("_id");
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const timeline = await TimelineEvent.find({ incidentId }).sort({ createdAt: 1 }).populate("performedBy", "name email role");
  return NextResponse.json({ timeline });
}
