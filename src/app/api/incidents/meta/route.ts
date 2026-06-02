import { NextResponse } from "next/server";
import { requireAuthedUser } from "@/app/api/incidents/helpers";
import { Department } from "@/lib/db/models/Department";
import { Station } from "@/lib/db/models/Station";

export async function GET() {
  const auth = await requireAuthedUser();
  if ("error" in auth) return auth.error;

  const [stations, departments] = await Promise.all([
    Station.find({ isActive: true }).select("_id code name fullName").sort({ code: 1 }).lean(),
    Department.find({ isActive: true }).select("_id code name").sort({ code: 1 }).lean(),
  ]);

  return NextResponse.json({ stations, departments });
}
