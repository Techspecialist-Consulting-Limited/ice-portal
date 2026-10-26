import { getSessionUser } from "../../auth/role-access";
import { SystemAdminShell } from "../system-admin-shell";
import { PORTAL_ACCOUNT_OVERVIEW, ROLE_ACCOUNT_COUNTS } from "./account-overview";
import {
  ShieldCheck,
  UserCheck,
  UserRound,
  UserRoundX,
  UsersRound,
} from "lucide-react";

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
    detail: "Access currently enabled",
    icon: UserCheck,
    tone: "success",
  },
  {
    label: "Suspended accounts",
    value: PORTAL_ACCOUNT_OVERVIEW.suspended,
    detail: "Access currently suspended",
    icon: UserRoundX,
    tone: "warning",
  },
  {
    label: "Portal roles",
    value: PORTAL_ACCOUNT_OVERVIEW.roleCount,
    detail: "Assigned access groups",
    icon: ShieldCheck,
    tone: "info",
  },
] as const;

const iconTones = {
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
} as const;

export default async function SystemAdminDashboardPage() {
  const user = await getSessionUser();
  const largestRoleCount = Math.max(...ROLE_ACCOUNT_COUNTS.map(({ count }) => count));

  return (
    <SystemAdminShell>
      <div className="mb-5">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Portal overview</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">
          Welcome, {user.name}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
          Review portal accounts and how access is assigned across the organization.
        </p>
      </div>

      <section aria-label="Portal account summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTones[tone]}`}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[12px] font-medium text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-[30px] font-semibold leading-9 tracking-tight text-[var(--foreground)]">{value}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="role-breakdown-heading" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 id="role-breakdown-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
              Accounts by role
            </h2>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">
            Portal accounts grouped by their assigned access role.
          </p>
        </div>

        <ul className="space-y-4">
          {ROLE_ACCOUNT_COUNTS.map(({ role, count }) => (
            <li key={role} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
              <span className="truncate text-[12px] font-medium text-[var(--foreground)]">{role}</span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--foreground)]">{count}</span>
              <span className="col-span-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                <span
                  className="block h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${(count / largestRoleCount) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </SystemAdminShell>
  );
}
