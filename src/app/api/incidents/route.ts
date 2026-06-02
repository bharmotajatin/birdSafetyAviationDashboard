import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  addTimelineEvent,
  computeGhrNo,
  getSlaHours,
  notifyStationSafetyHead,
  parseDateRange,
  requireAuthedUser,
  visibilityFilter,
} from "@/app/api/incidents/helpers";
import { Incident } from "@/lib/db/models/Incident";

export async function GET(req: NextRequest) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const params = req.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 20), 1), 100);
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { ...visibilityFilter(user) };
  const status = params.get("status");
  const station = params.get("station");
  const category = params.get("category");
  const department = params.get("department");
  const search = params.get("search");
  const dateRange = parseDateRange(params.get("from"), params.get("to"));

  if (status) query.status = status;
  if (station && Types.ObjectId.isValid(station)) query.station = new Types.ObjectId(station);
  if (category) query.incidentCategory = category;
  if (department && Types.ObjectId.isValid(department)) query.department = new Types.ObjectId(department);
  if (dateRange) query.dateOfIncident = dateRange;
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { ghrNo: regex },
      { incidentTitle: regex },
      { incidentBrief: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Incident.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("station", "code name fullName")
      .populate("department", "code name")
      .populate("createdBy", "name email role")
      .populate("assignedInvestigator", "name email role")
      .lean(),
    Incident.countDocuments(query),
  ]);

  return NextResponse.json({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    items,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (!["admin", "safety_head", "duty_manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const required = ["incidentTitle", "dateOfIncident", "station", "department", "operationalPhase", "incidentType", "incidentCategory", "incidentBrief"];
  for (const key of required) {
    if (!body?.[key]) {
      return NextResponse.json({ error: `Missing required field: ${key}` }, { status: 400 });
    }
  }

  if (!Types.ObjectId.isValid(String(body.station)) || !Types.ObjectId.isValid(String(body.department))) {
    return NextResponse.json({ error: "Invalid station or department id." }, { status: 400 });
  }

  const stationId = new Types.ObjectId(String(body.station));
  const departmentId = new Types.ObjectId(String(body.department));
  const { ghrNo, serialNo } = await computeGhrNo(stationId);
  const slaHours = await getSlaHours(String(body.incidentCategory));
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const created: any = await Incident.create({
    ghrNo,
    serialNo,
    incidentTitle: String(body.incidentTitle),
    dateOfIncident: new Date(body.dateOfIncident),
    timeOfIncident: String(body.timeOfIncident ?? ""),
    dateReported: body.dateReported ? new Date(body.dateReported) : new Date(),
    location: {
      text: String(body.location?.text ?? body.location ?? ""),
      bay: String(body.location?.bay ?? ""),
      gate: String(body.location?.gate ?? ""),
      zone: String(body.location?.zone ?? ""),
    },
    station: stationId,
    department: departmentId,
    operationalPhase: String(body.operationalPhase) as any,
    incidentType: String(body.incidentType) as any,
    incidentCategory: String(body.incidentCategory) as any,
    status: "Open",
    incidentBrief: String(body.incidentBrief),
    personInvolved: body.personInvolved ?? {},
    injuryDetails: body.injuryDetails ?? {},
    weatherConditions: String(body.weatherConditions ?? ""),
    equipmentInvolved: String(body.equipmentInvolved ?? ""),
    immediateAction: String(body.immediateAction ?? ""),
    rootCause: String(body.rootCause ?? ""),
    correctiveAction: String(body.correctiveAction ?? ""),
    preventiveAction: String(body.preventiveAction ?? ""),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    createdBy: user._id,
    slaDeadline,
    isOverdueSLA: false,
  } as any);

  await addTimelineEvent({
    incidentId: created._id,
    eventType: "created",
    description: `Incident ${created.ghrNo} created`,
    performedBy: user._id,
    newValue: { status: "Open" },
  });

  await notifyStationSafetyHead(stationId, created._id, created.ghrNo);

  return NextResponse.json({ incident: created }, { status: 201 });
}
