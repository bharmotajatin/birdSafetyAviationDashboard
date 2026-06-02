import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/requireAdmin";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { Department } from "@/lib/db/models/Department";
import { Station } from "@/lib/db/models/Station";
import { User, USER_ROLES } from "@/lib/db/models/User";
import { sendEmail } from "@/lib/email/mailer";

function card(extra = "") {
  return `rounded-xl border border-[#1a2a5e]/10 bg-white p-4 shadow-sm ${extra}`.trim();
}

function tempPassword() {
  return `Bfs@${Math.random().toString(36).slice(2, 8)}!`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; station?: string; q?: string }>;
}) {
  const admin = await requireAdminUser();
  await dbConnect();
  const params = (await searchParams) ?? {};
  const role = params.role?.trim() || "";
  const station = params.station?.trim() || "";
  const q = params.q?.trim() || "";

  const filter: Record<string, unknown> = {};
  if (role && USER_ROLES.includes(role as any)) filter.role = role as any;
  if (station) filter.station = station;
  if (q) filter.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];

  const [users, stations, departments] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).populate("station", "code fullName").populate("department", "code name").lean(),
    Station.find().sort({ code: 1 }).lean(),
    Department.find().sort({ code: 1 }).lean(),
  ]);

  async function inviteUser(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const roleValue = String(formData.get("role") || "viewer").trim();
    const stationId = String(formData.get("station") || "").trim() || null;
    const departmentId = String(formData.get("department") || "").trim() || null;
    if (!email || !name) return;

    const plain = tempPassword();
    const passwordHash = await bcrypt.hash(plain, 10);

    const created = (await User.create({
      email,
      name,
      role: (USER_ROLES.includes(roleValue as any) ? roleValue : "viewer") as any,
      station: stationId,
      department: departmentId,
      passwordHash,
      isActive: true,
    })) as any;

    const emailResult = await sendEmail({
      to: email,
      subject: "[BFS SMS] Your account invitation",
      text: `Hello ${name},\n\nYour account has been created.\nEmail: ${email}\nTemporary Password: ${plain}\nPlease login and change it immediately.\n`,
    });

    await ActivityLog.create({
      type: "admin_action",
      action: "user_invited",
      message: `Admin invited user ${email}`,
      actorUserId: adminUser._id,
      targetUserId: created._id,
      metadata: { emailSent: emailResult.sent },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/activity-log");
  }

  async function updateUser(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();
    const userId = String(formData.get("userId") || "");
    const roleValue = String(formData.get("role") || "viewer");
    const stationId = String(formData.get("station") || "").trim() || null;
    const departmentId = String(formData.get("department") || "").trim() || null;
    if (!userId) return;

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          role: (USER_ROLES.includes(roleValue as any) ? roleValue : "viewer") as any,
          station: stationId,
          department: departmentId,
        },
      },
    );

    await ActivityLog.create({
      type: "admin_action",
      action: "user_updated",
      message: `Admin updated user ${userId}`,
      actorUserId: adminUser._id,
      targetUserId: userId,
      metadata: { role: roleValue, stationId, departmentId },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/activity-log");
  }

  async function deactivateUser(formData: FormData) {
    "use server";
    const adminUser = await requireAdminUser();
    await dbConnect();
    const userId = String(formData.get("userId") || "");
    if (!userId) return;

    await User.updateOne({ _id: userId }, { $set: { isActive: false } });
    await ActivityLog.create({
      type: "admin_action",
      action: "user_deactivated",
      message: `Admin deactivated user ${userId}`,
      actorUserId: adminUser._id,
      targetUserId: userId,
    });
    revalidatePath("/admin/users");
    revalidatePath("/admin/activity-log");
  }

  return (
    <div className="space-y-6">
      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Filters</h2>
        <form className="grid gap-3 md:grid-cols-4">
          <input name="q" defaultValue={q} placeholder="Search name/email" className="rounded border px-3 py-2 text-sm" />
          <select name="role" defaultValue={role} className="rounded border px-3 py-2 text-sm">
            <option value="">All roles</option>
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="station" defaultValue={station} className="rounded border px-3 py-2 text-sm">
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={String(s._id)} value={String(s._id)}>
                {s.code}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-[#1a2a5e] px-3 py-2 text-sm font-semibold text-white">
            Apply
          </button>
        </form>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Invite New User</h2>
        <form action={inviteUser} className="grid gap-3 md:grid-cols-6">
          <input name="name" placeholder="Full name" required className="rounded border px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="rounded border px-3 py-2 text-sm" />
          <select name="role" defaultValue="viewer" className="rounded border px-3 py-2 text-sm">
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="station" className="rounded border px-3 py-2 text-sm">
            <option value="">No station</option>
            {stations.map((s) => (
              <option key={String(s._id)} value={String(s._id)}>
                {s.code}
              </option>
            ))}
          </select>
          <select name="department" className="rounded border px-3 py-2 text-sm">
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={String(d._id)} value={String(d._id)}>
                {d.code}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-[#d4af37] px-3 py-2 text-sm font-bold text-[#1a2a5e]">
            Invite New User
          </button>
        </form>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Users</h2>
        <div className="space-y-3">
          {users.map((u) => (
            <div key={String(u._id)} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#1a2a5e]">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <form action={updateUser} className="grid gap-2 md:grid-cols-5">
                <input type="hidden" name="userId" value={String(u._id)} />
                <select name="role" defaultValue={u.role} className="rounded border px-2 py-1 text-sm">
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select name="station" defaultValue={u.station ? String((u.station as any)._id ?? u.station) : ""} className="rounded border px-2 py-1 text-sm">
                  <option value="">No station</option>
                  {stations.map((s) => (
                    <option key={String(s._id)} value={String(s._id)}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <select
                  name="department"
                  defaultValue={u.department ? String((u.department as any)._id ?? u.department) : ""}
                  className="rounded border px-2 py-1 text-sm"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={String(d._id)} value={String(d._id)}>
                      {d.code}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded border border-[#1a2a5e]/20 px-2 py-1 text-sm text-[#1a2a5e]">
                  Save
                </button>
              </form>

              <div className="mt-2 flex items-center gap-2">
                {u.isActive ? (
                  <form action={deactivateUser}>
                    <input type="hidden" name="userId" value={String(u._id)} />
                    <button type="submit" className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      Deactivate
                    </button>
                  </form>
                ) : null}
                <a href={`/admin/activity-log?q=${encodeURIComponent(u.email)}`} className="text-xs font-semibold text-[#1a2a5e] underline">
                  View user activity log
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
