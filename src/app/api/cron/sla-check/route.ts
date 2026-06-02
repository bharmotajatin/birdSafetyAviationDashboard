import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { runSlaCheck } from "@/lib/sla/checker";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");

  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  try {
    const result = await runSlaCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await dbConnect();
    await ActivityLog.create({
      type: "system_error",
      action: "sla_check_failed",
      message: error instanceof Error ? error.message : "SLA check failed",
      metadata: { source: "api/cron/sla-check" },
    });
    return NextResponse.json({ error: "SLA check failed" }, { status: 500 });
  }
}
