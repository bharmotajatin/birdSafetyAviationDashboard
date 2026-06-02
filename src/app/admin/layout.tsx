import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/requireAdmin";

const tabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/stations", label: "Stations" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/activity-log", label: "Activity Log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#1a2a5e] to-[#24377a] p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-slate-200">System administration and governance</p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-lg border border-[#1a2a5e]/20 bg-white px-3 py-2 text-sm font-semibold text-[#1a2a5e]"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
