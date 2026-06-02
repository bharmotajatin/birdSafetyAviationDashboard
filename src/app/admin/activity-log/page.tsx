import { requireAdminUser } from "@/lib/auth/requireAdmin";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";

function card(extra = "") {
  return `rounded-xl border border-[#1a2a5e]/10 bg-white p-4 shadow-sm ${extra}`.trim();
}

export default async function AdminActivityLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string; action?: string }>;
}) {
  await requireAdminUser();
  await dbConnect();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() || "";
  const type = params.type?.trim() || "";
  const action = params.action?.trim() || "";

  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (action) filter.action = action;
  if (q) filter.message = new RegExp(q, "i");

  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate("actorUserId", "name email role")
    .populate("targetUserId", "name email role")
    .lean();

  return (
    <div className="space-y-6">
      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">Filters</h2>
        <form className="grid gap-3 md:grid-cols-4">
          <input name="q" defaultValue={q} placeholder="Search message" className="rounded border px-3 py-2 text-sm" />
          <select name="type" defaultValue={type} className="rounded border px-3 py-2 text-sm">
            <option value="">All types</option>
            <option value="login">login</option>
            <option value="admin_action">admin_action</option>
            <option value="system_error">system_error</option>
          </select>
          <input name="action" defaultValue={action} placeholder="Action key (optional)" className="rounded border px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-[#1a2a5e] px-3 py-2 text-sm font-semibold text-white">
            Apply
          </button>
        </form>
      </section>

      <section className={card()}>
        <h2 className="mb-3 text-lg font-semibold text-[#1a2a5e]">System-wide Activity Log</h2>
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={String(log._id)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#1a2a5e]/10 px-2 py-0.5 text-xs font-semibold text-[#1a2a5e]">{log.type}</span>
                <span className="rounded bg-[#d4af37]/20 px-2 py-0.5 text-xs font-semibold text-[#1a2a5e]">{log.action}</span>
                <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-800">{log.message}</p>
              <p className="text-xs text-slate-500">
                Actor: {(log.actorUserId as any)?.email ?? "-"} | Target: {(log.targetUserId as any)?.email ?? "-"}
              </p>
            </div>
          ))}
          {!logs.length ? <p className="text-sm text-slate-500">No activity logs found for current filters.</p> : null}
        </div>
      </section>
    </div>
  );
}
