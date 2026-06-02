import { NextResponse } from "next/server";
import { visibilityFilter, requireAuthedUser } from "@/app/api/incidents/helpers";
import { Incident } from "@/lib/db/models/Incident";

type CachedStats = {
  key: string;
  expiresAt: number;
  payload: Record<string, unknown>;
};

let statsCache: CachedStats | null = null;

function cacheKey(userId: string, role: string, station: string | null) {
  return `${userId}:${role}:${station ?? "none"}`;
}

export async function GET() {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const key = cacheKey(String(user._id), user.role, user.station ? String(user.station) : null);
  const now = Date.now();
  if (statsCache && statsCache.key === key && statsCache.expiresAt > now) {
    return NextResponse.json({ ...(statsCache.payload as Record<string, unknown>), cached: true });
  }

  const match = visibilityFilter(user);
  const [
    totalAgg,
    byStatus,
    byCategory,
    byDepartment,
    monthlyTrend,
    stationStats,
  ] = await Promise.all([
    Incident.aggregate([{ $match: match }, { $count: "total" }]),
    Incident.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Incident.aggregate([{ $match: match }, { $group: { _id: "$incidentCategory", count: { $sum: 1 } } }]),
    Incident.aggregate([
      { $match: match },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "department" } },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, departmentId: "$_id", department: "$department.code", count: 1 } },
    ]),
    Incident.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            y: { $year: "$dateOfIncident" },
            m: { $month: "$dateOfIncident" },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]),
    Incident.aggregate([
      { $match: match },
      { $group: { _id: "$station", total: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } } } },
      { $lookup: { from: "stations", localField: "_id", foreignField: "_id", as: "station" } },
      { $unwind: { path: "$station", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, stationId: "$_id", station: "$station.code", total: 1, open: 1 } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const total = totalAgg[0]?.total ?? 0;
  const riskScore =
    total === 0
      ? 0
      : Math.round(
          ((byCategory.find((x) => x._id === "CAT-A")?.count ?? 0) * 4 +
            (byCategory.find((x) => x._id === "CAT-B")?.count ?? 0) * 2 +
            (byCategory.find((x) => x._id === "CAT-C")?.count ?? 0)) /
            total,
        );

  const payload = {
    total,
    byStatus,
    byCategory,
    byDepartment,
    monthlyTrend,
    stationStats,
    riskScores: {
      weightedCategoryRisk: riskScore,
      overdueRate: total
        ? Math.round(
            ((byStatus.find((x) => x._id === "Pending")?.count ?? 0) / total) * 100,
          )
        : 0,
    },
  };

  statsCache = {
    key,
    payload,
    expiresAt: now + 60_000,
  };

  return NextResponse.json({ ...payload, cached: false });
}
