import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/requireAdmin";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { Incident } from "@/lib/db/models/Incident";
import { Station } from "@/lib/db/models/Station";
import { User } from "@/lib/db/models/User";

function card(extra = "") {
  return `rounded-xl border border-[#1a2a5e]/10 bg-white p-4 shadow-sm ${extra}`.trim();
}

export default async function AdminStationsPage() {
  const admin = await requireAdminUser();
  await dbConnect();

  const [stations, safetyHeads] = await Promise.all([
    Station.find().sort({ code: 1 }).lean(),
    User.find({ role: "safety_head", isActive: true }).sort({ name: 1 }).lean(),
  ]);

  const stats = await Incident.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    {
      $group: {
        _id: "$station",
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
        overdue: { $sum: { $cond: ["$isOverdueSLA", 1, 0] } },
      },
    },
  ]);
  const statsMap = new Map(stats.map((s) => [String(s._id), s]));

  async function addStation(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();
    const code = String(formData.get("code") || "").trim().toUpperCase();
    const fullName = String(formData.get("fullName") || "").trim();
    const timezone = String(formData.get("timezone") || "Asia/Kolkata").trim();
    if (!code || !fullName) return;

    const created = await Station.create({
      code,
      name: code,
      fullName,
      timezone,
      isActive: true,
    });

    await ActivityLog.create({
      type: "admin_action",
      action: "station_created",
      message: `Station ${code} created`,
      actorUserId: adminUser._id,
      metadata: { stationId: created._id, code },
    });

    revalidatePath("/admin/stations");
    revalidatePath("/admin/activity-log");
  }

  async function updateStation(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();
    const stationId = String(formData.get("stationId") || "");
    if (!stationId) return;

    const fullName = String(formData.get("fullName") || "").trim();
    const timezone = String(formData.get("timezone") || "").trim();
    const safetyHeadUserId = String(formData.get("safetyHeadUserId") || "").trim() || null;
    const isActive = String(formData.get("isActive") || "true") === "true";

    await Station.updateOne(
      { _id: stationId },
      { $set: { fullName, timezone, safetyHeadUserId, isActive } },
    );

    await ActivityLog.create({
      type: "admin_action",
      action: "station_updated",
      message: `Station ${stationId} updated`,
      actorUserId: adminUser._id,
      metadata: { safetyHeadUserId, isActive },
    });

    revalidatePath("/admin/stations");
    revalidatePath("/admin/activity-log");
  }

  return (
    <div className="space-y-6">
      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Add New Station</h2>
        <form action={addStation} className="grid gap-3 md:grid-cols-4">
          <input name="code" placeholder="Code (e.g. BOM)" required className="rounded border px-3 py-2 text-sm" />
          <input name="fullName" placeholder="Full name" required className="rounded border px-3 py-2 text-sm" />
          <input name="timezone" defaultValue="Asia/Kolkata" className="rounded border px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-[#d4af37] px-3 py-2 text-sm font-bold text-[#1a2a5e]">
            Add Station
          </button>
        </form>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Stations</h2>
        <div className="space-y-3">
          {stations.map((s) => {
            const stat = statsMap.get(String(s._id));
            return (
              <div key={String(s._id)} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-[#1a2a5e]">
                    {s.code} - {s.fullName}
                  </p>
                  <span className="text-xs text-slate-500">
                    Total: {stat?.total ?? 0} | Open: {stat?.open ?? 0} | Overdue: {stat?.overdue ?? 0}
                  </span>
                </div>
                <form action={updateStation} className="grid gap-2 md:grid-cols-5">
                  <input type="hidden" name="stationId" value={String(s._id)} />
                  <input name="fullName" defaultValue={s.fullName} className="rounded border px-2 py-1 text-sm" />
                  <input name="timezone" defaultValue={s.timezone} className="rounded border px-2 py-1 text-sm" />
                  <select
                    name="safetyHeadUserId"
                    defaultValue={s.safetyHeadUserId ? String(s.safetyHeadUserId) : ""}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {safetyHeads.map((u) => (
                      <option key={String(u._id)} value={String(u._id)}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <select name="isActive" defaultValue={s.isActive ? "true" : "false"} className="rounded border px-2 py-1 text-sm">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <button type="submit" className="rounded border border-[#1a2a5e]/20 px-2 py-1 text-sm text-[#1a2a5e]">
                    Save
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
