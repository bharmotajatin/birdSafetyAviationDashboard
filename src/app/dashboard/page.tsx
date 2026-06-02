import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import { Incident } from "@/lib/db/models/Incident";
import { Notification } from "@/lib/db/models/Notification";
import { Station } from "@/lib/db/models/Station";
import { TimelineEvent } from "@/lib/db/models/TimelineEvent";
import { User, type UserRole } from "@/lib/db/models/User";

type LeanIncident = {
  _id: string;
  ghrNo: string;
  incidentTitle: string;
  status: string;
  incidentCategory: string;
  dateOfIncident: Date;
  createdAt: Date;
  updatedAt: Date;
  isOverdueSLA: boolean;
  assignedInvestigator?: { _id: string; name?: string | null } | null;
};

function cardClassName(extra = "") {
  return `rounded-xl border border-[#1a2a5e]/10 bg-white p-4 shadow-sm ${extra}`.trim();
}

function kpiCard(title: string, value: string | number, sub?: string) {
  return (
    <div className={cardClassName()}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-[#1a2a5e]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function sectionTitle(title: string, action?: React.ReactNode) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-[#1a2a5e]">{title}</h2>
      {action}
    </div>
  );
}

function statusPill(status: string) {
  const style =
    status === "Closed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "In Progress"
        ? "bg-amber-100 text-amber-700"
        : status === "Pending"
          ? "bg-purple-100 text-purple-700"
          : "bg-slate-100 text-slate-700";
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${style}`}>{status}</span>;
}

function formatGreeting(name?: string | null) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name || "there"}`;
}

function monthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / 86400000);
}

function MiniTrendChart({ points }: { points: Array<{ month: string; value: number }> }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={cardClassName()}>
      {sectionTitle("Monthly Trend")}
      <div className="flex h-28 items-end gap-2">
        {points.map((point) => (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[#d4af37]"
              style={{ height: `${Math.max(6, Math.round((point.value / max) * 100))}%` }}
              title={`${point.month}: ${point.value}`}
            />
            <span className="text-[10px] text-slate-500">{point.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getCommonData(userId: string, role: UserRole) {
  const unreadNotifications = await Notification.countDocuments({ userId, isRead: false });
  const baseMatch = { isDeleted: { $ne: true } };
  const monthly = await Incident.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: { y: { $year: "$dateOfIncident" }, m: { $month: "$dateOfIncident" } },
        value: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": -1, "_id.m": -1 } },
    { $limit: 6 },
  ]);

  const trend = monthly
    .reverse()
    .map((item) => ({ month: `${String(item._id.m).padStart(2, "0")}/${String(item._id.y).slice(-2)}`, value: item.value as number }));

  const quickLinks =
    role === "viewer"
      ? ["/incident-log", "/pan-india", "/station-analysis", "/monthly", "/graphs", "/pattern-analysis"]
      : ["/incidents/new", "/incidents", "/pan-india", "/graphs", "/pattern-analysis"];

  return { unreadNotifications, trend, quickLinks };
}

async function dutyManagerView(userId: string) {
  const monthStart = monthStartDate();
  const [recentReports, actionRequired, totalThisMonth, catAThisMonth, closedVsTotal] = await Promise.all([
    Incident.find({ isDeleted: { $ne: true }, createdBy: userId }).sort({ createdAt: -1 }).limit(8).lean(),
    Incident.find({
      isDeleted: { $ne: true },
      createdBy: userId,
      status: { $in: ["Pending", "Rejected"] },
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
    Incident.countDocuments({ isDeleted: { $ne: true }, createdBy: userId, createdAt: { $gte: monthStart } }),
    Incident.countDocuments({
      isDeleted: { $ne: true },
      createdBy: userId,
      createdAt: { $gte: monthStart },
      incidentCategory: "CAT-A",
    }),
    Incident.aggregate([
      { $match: { isDeleted: { $ne: true }, createdBy: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          closed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const closureRate = closedVsTotal[0]?.total ? Math.round((closedVsTotal[0].closed / closedVsTotal[0].total) * 100) : 0;

  return { recentReports, actionRequired, totalThisMonth, catAThisMonth, closureRate };
}

async function investigatorView(userId: string) {
  const monthStart = monthStartDate();
  const assignedMatch = { isDeleted: { $ne: true }, assignedInvestigator: userId };
  const [assigned, needsInput, assignedCount, completedThisMonth, resolution] = await Promise.all([
    Incident.find(assignedMatch).sort({ updatedAt: -1 }).limit(12).lean(),
    Incident.find({ ...assignedMatch, status: { $in: ["Open", "Pending"] } }).sort({ updatedAt: -1 }).limit(10).lean(),
    Incident.countDocuments(assignedMatch),
    Incident.countDocuments({
      ...assignedMatch,
      status: "Closed",
      closedAt: { $gte: monthStart },
    }),
    Incident.aggregate([
      {
        $match: {
          ...assignedMatch,
          status: "Closed",
          closedAt: { $ne: null },
        },
      },
      {
        $project: {
          days: {
            $divide: [{ $subtract: ["$closedAt", "$createdAt"] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      { $group: { _id: null, avgDays: { $avg: "$days" } } },
    ]),
  ]);

  return {
    assigned,
    needsInput,
    assignedCount,
    completedThisMonth,
    avgResolutionDays: Math.round((resolution[0]?.avgDays ?? 0) * 10) / 10,
  };
}

async function safetyHeadView(user: { station?: unknown | null }) {
  const stationMatch = user.station ? { station: user.station } : {};
  const base = { isDeleted: { $ne: true }, ...stationMatch };

  const [pendingReviews, overdueIncidents, stationTotals, todayFeed, patternRisk] = await Promise.all([
    Incident.find({ ...base, status: { $in: ["Pending", "Reviewed"] } }).sort({ updatedAt: -1 }).limit(12).lean(),
    Incident.find({ ...base, isOverdueSLA: true, status: { $ne: "Closed" } }).sort({ slaDeadline: 1 }).limit(10).lean(),
    Incident.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] } },
          catA: { $sum: { $cond: [{ $eq: ["$incidentCategory", "CAT-A"] }, 1, 0] } },
        },
      },
    ]),
    Incident.find({
      ...base,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Incident.aggregate([
      { $match: base },
      { $group: { _id: "$incidentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return { pendingReviews, overdueIncidents, stationTotals: stationTotals[0], todayFeed, patternRisk };
}

async function adminView() {
  const [usersByRole, activeStations, totalIncidents, dbStats, adminActions] = await Promise.all([
    User.aggregate([{ $match: { isActive: true } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
    Station.countDocuments({ isActive: true }),
    Incident.countDocuments({ isDeleted: { $ne: true } }),
    (await dbConnect()).connection.db?.stats(),
    TimelineEvent.find().sort({ createdAt: -1 }).limit(10).populate("performedBy", "name role").lean(),
  ]);

  return { usersByRole, activeStations, totalIncidents, dbSize: dbStats?.dataSize ?? 0, adminActions };
}

function renderIncidentList(items: LeanIncident[], emptyText: string, overdueAsRed = false) {
  if (!items.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link
          key={String(item._id)}
          href={`/incidents/${item._id}`}
          className={`flex items-start justify-between rounded-lg border px-3 py-2 text-sm transition hover:border-[#d4af37] ${
            overdueAsRed && item.isOverdueSLA ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
          }`}
        >
          <div>
            <p className="font-semibold text-[#1a2a5e]">{item.ghrNo}</p>
            <p className="text-slate-700">{item.incidentTitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusPill(item.status)}
            <span className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await dbConnect();

  const userId = String(user._id);
  const role = user.role as UserRole;
  const common = await getCommonData(userId, role);
  const dutyData = role === "duty_manager" ? await dutyManagerView(userId) : null;
  const investigatorData = role === "investigator" ? await investigatorView(userId) : null;
  const safetyData = role === "safety_head" ? await safetyHeadView(user) : null;
  const adminData = role === "admin" ? await adminView() : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-[#1a2a5e] to-[#24377a] p-5 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[#d4af37]">Personalized Dashboard</p>
            <h1 className="text-2xl font-bold">{formatGreeting(user.name)}</h1>
            <p className="text-sm text-slate-200">Role: {role.replace("_", " ").toUpperCase()}</p>
          </div>
          <div className="relative rounded-full border border-[#d4af37]/60 px-3 py-2 text-sm">
            <span>🔔 {common.unreadNotifications}</span>
            <span className="ml-1 text-[#d4af37]">unread</span>
          </div>
        </div>
      </div>

      {role === "duty_manager" ? (
        <div className="space-y-4">
          <Link
            href="/incidents/new"
            className="block rounded-xl bg-[#d4af37] px-6 py-4 text-center text-xl font-bold text-[#1a2a5e] shadow hover:brightness-105"
          >
            + Report New Incident
          </Link>
          <div className="grid gap-3 sm:grid-cols-3">
            {kpiCard("My reports this month", String(dutyData?.totalThisMonth ?? 0))}
            {kpiCard("My CAT-A count", String(dutyData?.catAThisMonth ?? 0))}
            {kpiCard("My closure rate", `${dutyData?.closureRate ?? 0}%`)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cardClassName()}>
              {sectionTitle("My Recent Reports")}
              {renderIncidentList((dutyData?.recentReports ?? []) as unknown as LeanIncident[], "No reports yet.")}
            </section>
            <section className={cardClassName()}>
              {sectionTitle("Action Required")}
              {renderIncidentList((dutyData?.actionRequired ?? []) as unknown as LeanIncident[], "No action required items.")}
            </section>
          </div>
        </div>
      ) : null}

      {role === "investigator" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {kpiCard("Assigned cases", String(investigatorData?.assignedCount ?? 0))}
            {kpiCard("Avg resolution time", `${investigatorData?.avgResolutionDays ?? 0} days`)}
            {kpiCard("Completed this month", String(investigatorData?.completedThisMonth ?? 0))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cardClassName()}>
              {sectionTitle("Assigned to Me")}
              {renderIncidentList((investigatorData?.assigned ?? []) as unknown as LeanIncident[], "No assigned cases.", true)}
            </section>
            <section className={cardClassName()}>
              {sectionTitle("Action Required")}
              {renderIncidentList((investigatorData?.needsInput ?? []) as unknown as LeanIncident[], "No pending investigator actions.")}
            </section>
          </div>
        </div>
      ) : null}

      {role === "safety_head" ? (
        <div className="space-y-4">
          {(safetyData?.overdueIncidents.length ?? 0) ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Overdue alert: {safetyData?.overdueIncidents.length ?? 0} incidents are beyond SLA.
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4">
            {kpiCard("Station total", String(safetyData?.stationTotals?.total ?? 0))}
            {kpiCard("Open", String(safetyData?.stationTotals?.open ?? 0))}
            {kpiCard("In Progress", String(safetyData?.stationTotals?.inProgress ?? 0))}
            {kpiCard("CAT-A", String(safetyData?.stationTotals?.catA ?? 0))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cardClassName()}>
              {sectionTitle("Pending Reviews Queue")}
              {renderIncidentList((safetyData?.pendingReviews ?? []) as unknown as LeanIncident[], "No pending reviews.")}
            </section>
            <section className={cardClassName()}>
              {sectionTitle("Today's New Incidents")}
              {renderIncidentList((safetyData?.todayFeed ?? []) as unknown as LeanIncident[], "No incidents reported today.")}
            </section>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <MiniTrendChart points={common.trend} />
            <section className={cardClassName()}>
              {sectionTitle("Pattern Analysis Alerts")}
              <div className="space-y-2 text-sm">
                {(safetyData?.patternRisk ?? []).map((p) => (
                  <div key={String(p._id)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {String(p._id)} recurring: {p.count} incidents
                  </div>
                ))}
                {!(safetyData?.patternRisk.length ?? 0) ? <p className="text-slate-500">No current pattern alert.</p> : null}
              </div>
            </section>
          </div>
          <section className={cardClassName()}>
            {sectionTitle("Quick Links")}
            <div className="flex flex-wrap gap-2">
              {common.quickLinks.map((href) => (
                <Link key={href} href={href} className="rounded border border-[#1a2a5e]/20 px-3 py-1.5 text-sm font-medium text-[#1a2a5e]">
                  {href}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {role === "admin" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {kpiCard("Active stations", String(adminData?.activeStations ?? 0))}
            {kpiCard("Total incidents", String(adminData?.totalIncidents ?? 0))}
            {kpiCard("Database size", `${Math.round((adminData?.dbSize ?? 0) / (1024 * 1024))} MB`)}
            {kpiCard("Unread notifications", String(common.unreadNotifications))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cardClassName()}>
              {sectionTitle("Total Users by Role")}
              <div className="space-y-2 text-sm">
                {(adminData?.usersByRole ?? []).map((entry) => (
                  <div key={String(entry._id)} className="flex justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-medium text-[#1a2a5e]">{String(entry._id).replace("_", " ")}</span>
                    <span className="font-semibold">{entry.count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className={cardClassName()}>
              {sectionTitle("User Management Quick Actions")}
              <div className="flex flex-wrap gap-2">
                <Link href="/login" className="rounded border border-[#1a2a5e]/20 px-3 py-1.5 text-sm font-medium text-[#1a2a5e]">
                  Invite User
                </Link>
                <Link href="/login" className="rounded border border-[#1a2a5e]/20 px-3 py-1.5 text-sm font-medium text-[#1a2a5e]">
                  Reset Password
                </Link>
                <Link href="/login" className="rounded border border-[#1a2a5e]/20 px-3 py-1.5 text-sm font-medium text-[#1a2a5e]">
                  Manage Roles
                </Link>
              </div>
            </section>
          </div>
          <section className={cardClassName()}>
            {sectionTitle("Recent Admin Actions Log")}
            <div className="space-y-2">
              {(adminData?.adminActions ?? []).map((event) => (
                <div key={String(event._id)} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-[#1a2a5e]">{event.description}</span>
                  <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {role === "viewer" ? (
        <div className="space-y-4">
          <section className={cardClassName()}>
            {sectionTitle("Read-only Summary")}
            <p className="text-sm text-slate-600">
              This scrollable view aggregates incident operations, station performance, monthly trend, graphs, and pattern intelligence.
            </p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <MiniTrendChart points={common.trend} />
            <section className={cardClassName()}>
              {sectionTitle("Dashboards")}
              <div className="space-y-2 text-sm">
                {common.quickLinks.map((href) => (
                  <Link key={href} href={href} className="block rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[#1a2a5e]">
                    Open {href}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
