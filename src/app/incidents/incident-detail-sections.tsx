"use client";

import { useSyncExternalStore } from "react";
import {
  CalendarClock,
  Flame,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import type { IncidentItem, IncidentTimelineEvent } from "@/app/dashboard/mock-data";
import { RISK_ADMINISTRATOR } from "@/app/auth/current-user";
import { useCurrentUser } from "@/app/auth/current-user-provider";
import { canResponderAccessIncident } from "@/app/responder/responder-access";
import {
  getCustomRoleServerSnapshot,
  getCustomRoleSnapshot,
  subscribeToCustomRoles,
} from "@/app/system-admin/roles/custom-role-store";
import type { EmergencyContact } from "@/app/system-admin/users/user-directory";
import { INITIAL_PORTAL_ACCOUNTS } from "@/app/system-admin/users/user-directory";

const infoIconTones = {
  danger: "bg-[#fee2e2] text-[#991b1b]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
  info: "bg-[#eaf3ff] text-[#1d4ed8]",
} as const;

function InfoBlock({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  tone: keyof typeof infoIconTones;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${infoIconTones[tone]}`}>
        <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--foreground)]">{value}</p>
        {hint && <p className="truncate text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
      </div>
    </div>
  );
}

function SosContactDetails({ incident }: { incident: IncidentItem }) {
  const currentUser = useCurrentUser();
  const { accounts } = useSyncExternalStore(
    subscribeToCustomRoles,
    getCustomRoleSnapshot,
    getCustomRoleServerSnapshot,
  );

  // Sensitive contact data: Risk Administrators, or the responder assigned to this incident.
  const authorised =
    currentUser.role === RISK_ADMINISTRATOR || canResponderAccessIncident(incident, currentUser);
  if (!authorised) return null;

  const reporter = incident.reporterId
    ? accounts.find((account) => account.id === incident.reporterId) ??
      INITIAL_PORTAL_ACCOUNTS.find((account) => account.id === incident.reporterId)
    : undefined;
  const isSos = incident.incidentType === "SOS";
  const contacts: Array<[string, EmergencyContact]> = [];
  if (reporter) {
    const { primary, secondary, tertiary } = reporter.emergencyContacts;
    if (primary) contacts.push(["Primary", primary]);
    if (secondary) contacts.push(["Secondary", secondary]);
    if (tertiary) contacts.push(["Tertiary", tertiary]);
  }

  return (
    <div
      className={`mt-5 rounded-xl border p-4 ${isSos ? "border-[#f1c9c9] bg-[#fff7f7]" : "border-[var(--border)] bg-[var(--muted)]"}`}
      aria-labelledby="reporter-contact-heading"
    >
      <div className="flex items-center gap-2">
        <Phone className={`h-[18px] w-[18px] ${isSos ? "text-[#991b1b]" : "text-[var(--primary)]"}`} strokeWidth={2} />
        <h3 id="reporter-contact-heading" className="text-[13px] font-semibold text-[var(--foreground)]">
          {isSos ? "SOS contact details" : "Reporter contact details"}
        </h3>
      </div>

      {!reporter ? (
        <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
          Contact details not available. This report is not linked to a reporter profile.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Reporter&rsquo;s direct phone
            </p>
            <p className="mt-1 text-[14px] font-medium text-[var(--foreground)]">
              {reporter.phone ? (
                <a href={`tel:${reporter.phone.replace(/\s+/g, "")}`} className="text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                  {reporter.phone}
                </a>
              ) : (
                "Not available"
              )}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Emergency contacts
            </p>
            {contacts.length === 0 ? (
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">No emergency contacts registered.</p>
            ) : (
              <ul className="mt-2 grid gap-3 sm:grid-cols-3">
                {contacts.map(([label, contact]) => (
                  <li key={label} className="min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5">
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
                    <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--foreground)]">{contact.name}</p>
                    <p className="truncate text-[12px] text-[var(--muted-foreground)]">{contact.relationship}</p>
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                      className="mt-1 block truncate text-[13px] font-medium text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      {contact.phone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IncidentOverviewSection({ incident }: { incident: IncidentItem }) {
  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident information</h2>

      <SosContactDetails incident={incident} />

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">Incident description</p>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-6 text-[var(--foreground)]">
          {incident.description?.trim() ? incident.description : "No description provided"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-4">
        <InfoBlock icon={Flame} tone="danger" label="Category" value={incident.category} />
        <InfoBlock
          icon={MapPin}
          tone="primary"
          label="Location"
          value={incident.location}
          hint={incident.floorArea}
        />
        <InfoBlock
          icon={UserRound}
          tone="info"
          label="Reported by"
          value={incident.reporter ?? incident.department ?? "Not available"}
          hint={incident.reporter ? incident.department : undefined}
        />
        <InfoBlock icon={CalendarClock} tone="primary" label="Submitted" value={incident.reported} />
      </div>
    </section>
  );
}

function isPendingEvent(event: IncidentTimelineEvent) {
  return /await|pending|not yet/i.test(event.title);
}

export function IncidentTimelineSection({ events }: { events: IncidentTimelineEvent[] }) {
  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident timeline</h2>
        {events.length > 0 && (
          <span className="text-[12px] text-[var(--muted-foreground)]">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      {events.length > 0 ? (
        <ol className="mt-5">
          {events.map((event, index) => {
            const pending = isPendingEvent(event);
            return (
              <li key={`${event.title}-${index}`} className="flex gap-3.5 pb-5 last:pb-0">
                <div className="flex w-3.5 flex-col items-center pt-1">
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded-full ring-4 ${
                      pending ? "bg-[#b77909] ring-[#fff4d6]" : "bg-[var(--primary)] ring-[#eaf7ee]"
                    }`}
                  />
                  {index < events.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <p className="text-[14px] font-medium text-[var(--foreground)]">{event.title}</p>
                    <span className="text-[12px] text-[var(--muted-foreground)]">{event.time}</span>
                  </div>
                  {event.actor && (
                    <p className="mt-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                      By {event.actor}
                    </p>
                  )}
                  <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">{event.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-6 text-center text-[13px] text-[var(--muted-foreground)]">
          No timeline events have been recorded for this incident yet. Events are added as reviewers and responders take action.
        </p>
      )}
    </section>
  );
}

export function IncidentRelatedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
