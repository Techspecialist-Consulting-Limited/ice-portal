import { getSessionUser } from "../../auth/role-access";
import { SystemAdminShell } from "../system-admin-shell";
import { PORTAL_ACCOUNT_OVERVIEW, ROLE_ACCOUNT_COUNTS } from "./account-overview";
import {
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
  Layers,
  Zap,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { RecentActivityPanel } from "./recent-activity-panel";
import { DashboardHeader } from "./dashboard-header";

const metrics = [
  {
    label: "Portal accounts",
    value: PORTAL_ACCOUNT_OVERVIEW.total,
    detail: "Across all portal roles",
    icon: UsersRound,
    tone: "primary",
  },
  {
    label: "Active accounts",
    value: PORTAL_ACCOUNT_OVERVIEW.active,
    detail: "Can currently access the portal",
    icon: UserCheck,
    tone: "success",
  },
  {
    label: "Suspended accounts",
    value: PORTAL_ACCOUNT_OVERVIEW.suspended,
    detail: "Currently suspended",
    icon: UserRoundX,
    tone: "warning",
  },
  {
    label: "Portal roles",
    value: PORTAL_ACCOUNT_OVERVIEW.roleCount,
    detail: "Assigned access groups",
    icon: Layers,
    tone: "info",
  },
] as const;

const iconTones = {
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
} as const;

const chartColors = [
  "var(--primary)",
  "#16a34a",
  "#4ade80",
  "#94a3b8",
] as const;

export default async function SystemAdminDashboardPage() {
  const user = await getSessionUser();
  const totalAccounts = PORTAL_ACCOUNT_OVERVIEW.total;
  const sortedRoles = [...ROLE_ACCOUNT_COUNTS].sort((a, b) => b.count - a.count);

  return (
    <SystemAdminShell>
      <DashboardHeader userName={user.name} />

      <section aria-label="Portal account summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
            <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconTones[tone]}`}>
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[13px] font-medium text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-[32px] font-semibold leading-9 tracking-tight text-[var(--foreground)]">{value}</p>
            <p className="mt-1.5 text-[12px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
          </article>
        ))}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="account-distribution-heading" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <div>
              <h2 id="account-distribution-heading" className="text-[17px] font-semibold text-[var(--foreground)]">
                Account distribution
              </h2>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                Breakdown of portal accounts by role.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative mx-auto sm:mx-0">
              <svg width="220" height="220" viewBox="0 0 220 220" className="transform" aria-label={`Donut chart showing ${totalAccounts} total accounts`}>
                <circle cx="110" cy="110" r="80" fill="none" stroke="var(--muted)" strokeWidth="32" />
                {sortedRoles.map((role, index) => {
                  const percentage = (role.count / totalAccounts) * 100;
                  const circumference = 2 * Math.PI * 80;
                  const strokeDasharray = (percentage / 100) * circumference;
                  const offset = index === 0 ? 0 : sortedRoles.slice(0, index).reduce((sum, r) => sum + (r.count / totalAccounts) * circumference, 0);
                  return (
                    <circle
                      key={role.role}
                      cx="110"
                      cy="110"
                      r="80"
                      fill="none"
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth="32"
                      strokeDasharray={`${strokeDasharray} ${circumference}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 110 110)"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[36px] font-semibold text-[var(--foreground)]">{totalAccounts}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">Total accounts</p>
              </div>
            </div>

            <ul className="flex-1 space-y-3">
              {sortedRoles.map((role, index) => {
                const percentage = Math.round((role.count / totalAccounts) * 100);
                return (
                  <li key={role.role} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} aria-hidden="true" />
                      <span className="text-[13px] font-medium text-[var(--foreground)]">{role.role}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold text-[var(--foreground)]">{role.count}</span>
                      <span className="text-[13px] text-[var(--muted-foreground)]">{percentage}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <RecentActivityPanel />
      </div>

      <section aria-label="Quick actions" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          <div>
            <h2 className="text-[17px] font-semibold text-[var(--foreground)]">Quick actions</h2>
            <p className="text-[12px] text-[var(--muted-foreground)]">Common administration tasks.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/system-admin/users"
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <UsersRound className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Manage portal users</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Add, edit, and manage user accounts.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </Link>
          <Link
            href="/system-admin/roles"
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Manage roles & access</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Configure roles and permissions.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </Link>
          <Link
            href="/system-admin/custom-roles"
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Create custom roles</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Define custom access roles.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </Link>
          <Link
            href="/system-admin/settings"
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Zap className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">Organization settings</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Update portal configuration.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </Link>
        </div>
      </section>
    </SystemAdminShell>
  );
}
