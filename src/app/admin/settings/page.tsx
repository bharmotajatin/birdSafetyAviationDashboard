import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/requireAdmin";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { Settings } from "@/lib/db/models/Settings";

function card(extra = "") {
  return `rounded-xl border border-[#1a2a5e]/10 bg-white p-4 shadow-sm ${extra}`.trim();
}

type SettingsMap = Record<string, any>;

function getValue(map: SettingsMap, key: string, fallback: any) {
  return map[key] ?? fallback;
}

export default async function AdminSettingsPage() {
  const admin = await requireAdminUser();
  await dbConnect();

  const settingsDocs = await Settings.find().lean();
  const map: SettingsMap = {};
  for (const item of settingsDocs) map[item.key] = item.value;

  async function saveSettings(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();

    const sla = {
      "CAT-A": Number(formData.get("slaCatA") || 24),
      "CAT-B": Number(formData.get("slaCatB") || 72),
      "CAT-C": Number(formData.get("slaCatC") || 168),
      "CAT-D": Number(formData.get("slaCatD") || 336),
    };
    const emailPrefs = {
      slaBreach: String(formData.get("emailSlaBreach") || "off") === "on",
      assignment: String(formData.get("emailAssignment") || "off") === "on",
      dailyDigest: String(formData.get("emailDailyDigest") || "off") === "on",
    };
    const announcement = String(formData.get("announcement") || "");
    const retentionDays = Number(formData.get("retentionDays") || 365);
    const workingHours = {
      start: String(formData.get("workStart") || "09:00"),
      end: String(formData.get("workEnd") || "18:00"),
      timezone: String(formData.get("workTz") || "Asia/Kolkata"),
    };

    const upserts = [
      { key: "sla.hoursByCategory", value: sla, description: "SLA hours by category" },
      { key: "email.preferences", value: emailPrefs, description: "Global email notification preferences" },
      { key: "system.announcement", value: announcement, description: "System-wide announcement text" },
      { key: "system.retentionDays", value: retentionDays, description: "Data retention in days" },
      { key: "system.workingHours", value: workingHours, description: "Operational working hours" },
    ];

    for (const item of upserts) {
      await Settings.updateOne(
        { key: item.key },
        { $set: { value: item.value, description: item.description, updatedBy: adminUser._id } },
        { upsert: true },
      );
    }

    await ActivityLog.create({
      type: "admin_action",
      action: "settings_updated",
      message: "Global settings were updated",
      actorUserId: adminUser._id,
      metadata: { keys: upserts.map((u) => u.key) },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/activity-log");
  }

  const sla = getValue(map, "sla.hoursByCategory", { "CAT-A": 24, "CAT-B": 72, "CAT-C": 168, "CAT-D": 336 });
  const emailPrefs = getValue(map, "email.preferences", { slaBreach: true, assignment: true, dailyDigest: false });
  const work = getValue(map, "system.workingHours", { start: "09:00", end: "18:00", timezone: "Asia/Kolkata" });

  return (
    <form action={saveSettings} className="space-y-6">
      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">SLA Hours Per Category</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input name="slaCatA" type="number" defaultValue={sla["CAT-A"]} className="rounded border px-3 py-2 text-sm" />
          <input name="slaCatB" type="number" defaultValue={sla["CAT-B"]} className="rounded border px-3 py-2 text-sm" />
          <input name="slaCatC" type="number" defaultValue={sla["CAT-C"]} className="rounded border px-3 py-2 text-sm" />
          <input name="slaCatD" type="number" defaultValue={sla["CAT-D"]} className="rounded border px-3 py-2 text-sm" />
        </div>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Email Notification Preferences</h2>
        <div className="grid gap-2 text-sm">
          <label className="flex items-center gap-2"><input name="emailSlaBreach" type="checkbox" defaultChecked={Boolean(emailPrefs.slaBreach)} /> SLA breach alerts</label>
          <label className="flex items-center gap-2"><input name="emailAssignment" type="checkbox" defaultChecked={Boolean(emailPrefs.assignment)} /> Investigator assignment alerts</label>
          <label className="flex items-center gap-2"><input name="emailDailyDigest" type="checkbox" defaultChecked={Boolean(emailPrefs.dailyDigest)} /> Daily digest</label>
        </div>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">System-wide Announcement</h2>
        <textarea name="announcement" defaultValue={String(getValue(map, "system.announcement", ""))} rows={4} className="w-full rounded border px-3 py-2 text-sm" />
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Data Retention</h2>
        <input
          name="retentionDays"
          type="number"
          defaultValue={Number(getValue(map, "system.retentionDays", 365))}
          className="rounded border px-3 py-2 text-sm"
        />
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Working Hours</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input name="workStart" defaultValue={String(work.start)} className="rounded border px-3 py-2 text-sm" />
          <input name="workEnd" defaultValue={String(work.end)} className="rounded border px-3 py-2 text-sm" />
          <input name="workTz" defaultValue={String(work.timezone)} className="rounded border px-3 py-2 text-sm" />
        </div>
      </section>

      <button type="submit" className="rounded bg-[#d4af37] px-4 py-2 font-bold text-[#1a2a5e]">
        Save Settings
      </button>
    </form>
  );
}
