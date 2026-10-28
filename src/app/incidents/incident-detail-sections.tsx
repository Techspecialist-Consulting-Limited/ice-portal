import {
  CalendarClock,
  Flame,
  Hash,
  MapPin,
  Smartphone,
  Tag,
  UserRound,
} from "lucide-react";
import type { IncidentItem, IncidentTimelineEvent } from "@/app/dashboard/mock-data";
import { incidentTypeLabel } from "./incident-status";

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
    <div className="flex min-w-0 items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${infoIconTones[tone]}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 truncate text-[14px] font-medium text-[var(--foreground)]">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[12px] text-[var(--muted-foreground)]">{hint}</p>}
      </div>
    </div>
  );
}

function MetaField({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

export function IncidentOverviewSection({ incident }: { incident: IncidentItem }) {
  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident information</h2>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBlock icon={Flame} tone="danger" label="Category" value={incident.category} />
        <InfoBlock icon={MapPin} tone="primary" label="Location" value={incident.location} />
        <InfoBlock
          icon={UserRound}
          tone="info"
          label="Reported by"
          value={incident.reporter ?? "Unknown reporter"}
          hint={incident.department}
        />
        <InfoBlock
          icon={Tag}
          tone="primary"
          label="Incident type"
          value={incidentTypeLabel(incident.incidentType)}
        />
      </div>

      <div className="my-5 h-px bg-[var(--border)]" />

      <div>
        <p className="text-[13px] font-semibold text-[var(--foreground)]">Incident description</p>
        <p className="mt-2 max-w-[72ch] text-[14px] leading-6 text-[var(--foreground)]">
          {incident.description?.trim() ? incident.description : "No description provided"}
        </p>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetaField icon={CalendarClock} label="Submitted" value={incident.reported} />
        <MetaField icon={Hash} label="Reference" value={incident.id} />
        <MetaField icon={Smartphone} label="Reporting channel" value={incident.channel ?? "Not available"} />
        <MetaField icon={Flame} label="Priority" value={incident.priority} />
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
