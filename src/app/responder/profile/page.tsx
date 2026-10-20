import Link from "next/link";
import { Building2, CalendarClock, ChevronRight, Hash, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { ResponderPortalShell } from "../responder-shell";
import { ToneBadge } from "../../incidents/incident-status";
import { formatAlertTimestamp } from "../../alerts/alert-status";
import {
  PROFILE_NOT_AVAILABLE,
  PROFILE_NOT_PROVIDED,
  initialsFromName,
} from "../../auth/current-user";
import { getSessionUser } from "../../auth/role-access";

function ProfileField({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 py-2.5">
      <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</dt>
        <dd className="mt-1 break-words text-[14px] font-medium text-[var(--foreground)]">{value}</dd>
      </div>
    </div>
  );
}

export default async function ResponderProfilePage() {
  const currentUser = await getSessionUser();
  const lastLogin = currentUser.lastLoginAt
    ? formatAlertTimestamp(currentUser.lastLoginAt)
    : PROFILE_NOT_AVAILABLE;

  return (
    <ResponderPortalShell
      activeNav="profile"
      breadcrumbs={
        <>
          <Link href="/responder/dashboard" className="hover:text-[var(--primary)]">Responder Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-[var(--foreground)]">Profile</span>
        </>
      }
      pageTitle="Profile"
      description="View your responder account information and assigned access role."
    >
      <section
        aria-labelledby="responder-profile-identity"
        className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#DDF2E7] text-[16px] font-semibold text-[#087443]"
          >
            {initialsFromName(currentUser.name) || "—"}
          </div>
          <div className="min-w-0">
            <h2 id="responder-profile-identity" className="truncate text-[20px] font-semibold leading-7 text-[var(--foreground)]">
              {currentUser.name || PROFILE_NOT_PROVIDED}
            </h2>
            <p className="mt-0.5 break-all text-[13px] text-[var(--muted-foreground)]">
              {currentUser.email || PROFILE_NOT_PROVIDED}
            </p>
            <div className="mt-2">
              <ToneBadge label={currentUser.role} tone="primary" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section
          aria-labelledby="responder-profile-account"
          className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="responder-profile-account" className="text-[15px] font-semibold text-[var(--foreground)]">
            Account information
          </h2>
          <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <ProfileField icon={UserRound} label="Full name" value={currentUser.name || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={Hash} label="Email address" value={currentUser.email || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={Building2} label="Department" value={currentUser.department || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={ShieldCheck} label="Assigned role" value={currentUser.role || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={CalendarClock} label="Last login" value={lastLogin} />
          </dl>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
            Account details are read-only. No sign-in session or directory connection is configured.
          </p>
        </section>

        <section
          aria-labelledby="responder-profile-access"
          className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="responder-profile-access" className="text-[15px] font-semibold text-[var(--foreground)]">
            Access information
          </h2>
          <dl className="mt-2 divide-y divide-[var(--border)]">
            <ProfileField icon={ShieldCheck} label="Assigned role" value={currentUser.role} />
            <ProfileField icon={MapPin} label="Current workspace" value="Incident Responder portal" />
          </dl>
          <Link
            href="/responder/dashboard"
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            Back to responder dashboard
          </Link>
        </section>
      </div>
    </ResponderPortalShell>
  );
}
