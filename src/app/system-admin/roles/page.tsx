"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileBarChart,
  KeyRound,
  LayoutDashboard,
  RadioTower,
  UsersRound,
} from "lucide-react";
import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
} from "../../auth/current-user";
import { SystemAdminShell } from "../system-admin-shell";
import {
  getCustomRoleServerSnapshot,
  getCustomRoleSnapshot,
  subscribeToCustomRoles,
} from "./custom-role-store";

const roleOverview = [
  {
    role: RISK_ADMINISTRATOR,
    description: "Coordinates risk operations and manages incident, alert, and security-feed workflows.",
    workspaces: [
      { label: "Risk dashboard", icon: LayoutDashboard },
      { label: "Incident management", icon: ClipboardList },
      { label: "Alerts & advisories", icon: RadioTower },
      { label: "Security Feed", icon: Activity },
      { label: "Operational reports", icon: FileBarChart },
    ],
  },
  {
    role: INCIDENT_RESPONDER,
    description: "Receives assigned cases and supports incident response and follow-up.",
    workspaces: [
      { label: "Responder dashboard", icon: LayoutDashboard },
      { label: "Assigned incidents", icon: ClipboardList },
      { label: "Personal profile", icon: UsersRound },
    ],
  },
  {
    role: MANAGEMENT_USER,
    description: "Reviews organization-wide operational summaries, trends, readiness, and reports.",
    workspaces: [
      { label: "Executive dashboard", icon: LayoutDashboard },
      { label: "Incident analytics", icon: ClipboardList },
      { label: "Alert analytics", icon: RadioTower },
      { label: "Trends & readiness", icon: Activity },
      { label: "Executive reports", icon: FileBarChart },
    ],
  },
  {
    role: SYSTEM_ADMINISTRATOR,
    description: "Oversees portal accounts and reviews how access is assigned across the organization.",
    workspaces: [
      { label: "Administration dashboard", icon: LayoutDashboard },
      { label: "Portal user directory", icon: UsersRound },
      { label: "Roles & access overview", icon: KeyRound },
    ],
  },
] as const;

export default function SystemAdminRolesPage() {
  const snapshot = useSyncExternalStore(
    subscribeToCustomRoles,
    getCustomRoleSnapshot,
    getCustomRoleServerSnapshot,
  );

  return (
    <SystemAdminShell>
      <div className="mb-5">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Access overview</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">
          Roles &amp; access
        </h1>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
          See the purpose of each portal role, the workspaces it uses, and the accounts currently assigned to it.
        </p>
      </div>

      <section aria-label="Portal role access comparison" className="space-y-3">
        {roleOverview.map(({ role, description, workspaces }) => {
          const accountCount = snapshot.accounts.filter((account) => account.role === role).length;
          return (
            <article key={role} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{role}</h2>
                      <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[var(--muted-foreground)]">{description}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Portal workspaces</h3>
                    <ul className="flex flex-wrap gap-2">
                      {workspaces.map(({ label, icon: Icon }) => (
                        <li key={label} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--foreground)]">
                          <Icon className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-3 lg:min-w-[170px] lg:flex-col lg:items-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <div className="lg:text-right">
                    <p className="text-[10px] text-[var(--muted-foreground)]">Portal accounts</p>
                    <p className="mt-0.5 text-[22px] font-semibold leading-7 tabular-nums text-[var(--foreground)]">{accountCount}</p>
                  </div>
                  <Link
                    href={`/system-admin/users?role=${encodeURIComponent(role)}`}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[10px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    View users
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </SystemAdminShell>
  );
}
