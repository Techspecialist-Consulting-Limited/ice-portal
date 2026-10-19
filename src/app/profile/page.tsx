import Link from "next/link";
import { Building2, CalendarClock, ChevronRight, Hash, LogOut, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { ToneBadge } from "../incidents/incident-status";
import { formatAlertTimestamp } from "../alerts/alert-status";
import {
  CURRENT_USER,
  PROFILE_NOT_AVAILABLE,
  PROFILE_NOT_PROVIDED,
  initialsFromName,
  type CurrentUser,
} from "../auth/current-user";

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
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

function Avatar({ user }: { user: CurrentUser }) {
  const initials = initialsFromName(user.name);
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)]"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#DDF2E7] text-[16px] font-semibold text-[#087443]"
    >
      {initials || "—"}
    </div>
  );
}

export default function ProfilePage() {
  const user = CURRENT_USER;
  const lastLogin = user.lastLoginAt ? formatAlertTimestamp(user.lastLoginAt) : PROFILE_NOT_AVAILABLE;

  return (
    <IncidentPortalShell
      activeNav="profile"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium text-[var(--foreground)]">Profile</span>
        </>
      }
      pageTitle="Profile"
      description="View your account information and assigned access role."
    >
      {/* Identity */}
      <section
        aria-labelledby="profile-identity-heading"
        className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={user} />
          <div className="min-w-0">
            <h2 id="profile-identity-heading" className="truncate text-[20px] font-semibold leading-7 text-[var(--foreground)]">
              {user.name || PROFILE_NOT_PROVIDED}
            </h2>
            <p className="mt-0.5 break-all text-[13px] text-[var(--muted-foreground)]">
              {user.email || PROFILE_NOT_PROVIDED}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ToneBadge label={user.role} tone="primary" />
              {user.department && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                  {user.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Required profile inventory, presented read-only (directory-owned). */}
        <section
          aria-labelledby="profile-account-heading"
          className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="profile-account-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
            Account information
          </h2>
          <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <ProfileField icon={UserRound} label="Full name" value={user.name || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={Hash} label="Email address" value={user.email || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={Building2} label="Department" value={user.department || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={ShieldCheck} label="Assigned role" value={user.role || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={CalendarClock} label="Last login" value={lastLogin} />
          </dl>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
            Organizational details such as your name, department and role are managed in the directory service and are
            read-only here.
          </p>
        </section>

        {/* Access context. Informational only — this page cannot change access. */}
        <section
          aria-labelledby="profile-access-heading"
          className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
        >
          <h2 id="profile-access-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
            Access information
          </h2>
          <dl className="mt-2 divide-y divide-[var(--border)]">
            <ProfileField icon={ShieldCheck} label="Assigned role" value={user.role || PROFILE_NOT_PROVIDED} />
            <ProfileField icon={MapPin} label="Current workspace" value={user.role || PROFILE_NOT_PROVIDED} />
          </dl>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
            Your role and workspace are assigned by an administrator. They cannot be changed from this page.
          </p>
        </section>
      </div>

      {/* Account actions */}
      <section
        aria-labelledby="profile-actions-heading"
        className="mt-4 rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 id="profile-actions-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
          Account actions
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            aria-describedby="profile-signout-note"
            title="Sign out is not available yet."
            className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 text-sm font-medium text-[#718178] opacity-70"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            Sign out
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            Back to dashboard
          </Link>
        </div>
        <p id="profile-signout-note" className="mt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
          Sign out is not available yet because the portal does not have a sign-in session to end.
        </p>
      </section>
    </IncidentPortalShell>
  );
}
