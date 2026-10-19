"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CircleX,
  Flame,
  Hash,
  Images,
  MapPin,
  Megaphone,
  MoreHorizontal,
  ShieldCheck,
  Smartphone,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import type { IncidentTimelineEvent } from "@/app/dashboard/mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../incident-state";
import { PriorityBadge, StatusBadge } from "../incident-status";
import { IncidentPortalShell } from "../incident-shell";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", infoIconTones[tone])}>
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

function isPendingEvent(event: IncidentTimelineEvent) {
  return /await|pending|not yet/i.test(event.title);
}

function RelatedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function ActionsMenu({ evidenceHref, hasEvidence }: { evidenceHref: string; hasEvidence: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Additional incident actions"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-white p-1 shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
        >
          {hasEvidence ? (
            <Link
              href={evidenceHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              <Images className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={1.9} />
              Open supporting media
            </Link>
          ) : (
            <span className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--muted-foreground)]">
              <Images className="h-4 w-4" strokeWidth={1.9} />
              No supporting media
            </span>
          )}
          <Link
            href="/incidents"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={1.9} />
            Back to incident queue
          </Link>
        </div>
      )}
    </div>
  );
}

function useIncident(id: string) {
  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );

  return incidents.find((item) => item.id === id) ?? null;
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 motion-reduce:animate-none xl:grid-cols-[1.65fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="h-3 w-40 rounded bg-[var(--muted)]" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-11 rounded-lg bg-[var(--muted)]" />
            ))}
          </div>
          <div className="mt-6 h-16 rounded-lg bg-[var(--muted)]" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-11 rounded-lg bg-[var(--muted)]" />
            ))}
          </div>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="h-3 w-32 rounded bg-[var(--muted)]" />
          <div className="mt-6 space-y-5">
            {[0, 1].map((index) => (
              <div key={index} className="h-10 rounded-lg bg-[var(--muted)]" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="h-3 w-20 rounded bg-[var(--muted)]" />
          <div className="mt-5 space-y-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-10 rounded-xl bg-[var(--muted)]" />
            ))}
          </div>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="h-3 w-36 rounded bg-[var(--muted)]" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-4 rounded bg-[var(--muted)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentDetailsContent() {
  const params = useParams();
  const incidentId = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "");
  const incident = useIncident(incidentId);

  const breadcrumbs = (current: React.ReactNode) => (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>
      <span aria-hidden="true">/</span>
      {current}
    </>
  );

  if (!incident) {
    return (
      <IncidentPortalShell
        breadcrumbs={breadcrumbs(<span className="font-medium text-[var(--foreground)]">Not found</span>)}
        pageTitle="Incident not found"
        description="The requested incident could not be located."
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            No incident matches the reference <span className="font-medium text-[var(--foreground)]">{incidentId || "provided"}</span>.
            It may have been removed or the reference may be incorrect.
          </p>
          <Link
            href="/incidents"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to incident queue
          </Link>
        </div>
      </IncidentPortalShell>
    );
  }

  // Only a recorded timeline is shown. Incidents without recorded events get an
  // explicit empty state rather than a synthesised "Incident reported" entry,
  // so the page never implies history that was not actually captured.
  const timeline = incident.timeline ?? [];
  const hasTimeline = timeline.length > 0;

  const hasEvidence = Boolean(incident.evidence && incident.evidence.length > 0);
  const watchers = incident.watchers != null
    ? `${incident.watchers} administrator${incident.watchers === 1 ? "" : "s"}`
    : "Not available";

  return (
    <IncidentPortalShell
      breadcrumbs={breadcrumbs(<span className="font-medium text-[var(--foreground)]">{incident.id}</span>)}
      pageTitle={incident.title}
      description={
        <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[13px] text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{incident.id}</span>
          <span aria-hidden="true">·</span>
          <span>Reported {incident.reported}</span>
        </span>
      }
      actions={
        <>
          <PriorityBadge priority={incident.priority} />
          <StatusBadge status={incident.status} />
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident information</h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <InfoBlock icon={Flame} tone="danger" label="Category" value={incident.category} />
              <InfoBlock icon={MapPin} tone="primary" label="Location" value={incident.location} />
              <InfoBlock
                icon={UserRound}
                tone="info"
                label="Reported by"
                value={incident.reporter ?? "Unknown reporter"}
                hint={incident.department}
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
              <MetaField icon={CalendarClock} label="Date & time" value={incident.reported} />
              <MetaField icon={Hash} label="Reference" value={incident.id} />
              <MetaField icon={Smartphone} label="Reporting channel" value={incident.channel ?? "Not available"} />
              <MetaField icon={Flame} label="Priority" value={incident.priority} />
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident timeline</h2>
              {hasTimeline && (
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {timeline.length} {timeline.length === 1 ? "event" : "events"}
                </span>
              )}
            </div>

            {hasTimeline ? (
              <ol className="mt-5">
                {timeline.map((event, index) => {
                  const pending = isPendingEvent(event);
                  return (
                    <li key={`${event.title}-${index}`} className="flex gap-3.5 pb-5 last:pb-0">
                      <div className="flex w-3.5 flex-col items-center pt-1">
                        <span
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 rounded-full ring-4",
                            pending ? "bg-[#b77909] ring-[#fff4d6]" : "bg-[var(--primary)] ring-[#eaf7ee]",
                          )}
                        />
                        {index < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
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
                No timeline events have been recorded for this incident yet. Events are added as reviewers and
                responders take action.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Actions</h2>
              <ActionsMenu evidenceHref={`/incidents/${incident.id}/evidence`} hasEvidence={hasEvidence} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {(incident.status === "Submitted" || incident.status === "Under review") && (
                <>
                  <Link
                    href={`/incidents/${incident.id}/review?decision=verify`}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  >
                    <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2} />
                    Verify incident
                  </Link>

                  <Link
                    href={`/incidents/${incident.id}/review?decision=reject`}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e0a8a8] bg-white px-4 text-sm font-medium text-[#991b1b] transition-colors hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#991b1b] focus-visible:ring-offset-2"
                  >
                    <CircleX className="h-[18px] w-[18px]" strokeWidth={2} />
                    Reject report
                  </Link>
                </>
              )}

              {incident.status === "Verified" && (
                <Link
                  href={`/incidents/${incident.id}/convert-to-alert`}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] px-4 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-softest)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <Megaphone className="h-[18px] w-[18px]" strokeWidth={2} />
                  Convert to alert
                </Link>
              )}

              {["Submitted", "Under review", "Verified", "Escalated", "Broadcast"].includes(incident.status) && (
                <Link
                  href={`/incidents/${incident.id}/assign`}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <UserRoundCheck className="h-[18px] w-[18px]" strokeWidth={2} />
                  Assign responder
                </Link>
              )}

              {["Submitted", "Under review", "Verified"].includes(incident.status) && (
                <Link
                  href={`/incidents/${incident.id}/assign?escalate=1`}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2} />
                  Escalate incident
                </Link>
              )}

              {["Verified", "Escalated", "Broadcast"].includes(incident.status) && (
                <Link href={`/incidents/${encodeURIComponent(incident.id)}/resolve`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] px-4 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-softest)]">
                  Resolve incident
                </Link>
              )}
              {incident.status === "Resolved" && (
                <Link href={`/incidents/${encodeURIComponent(incident.id)}/resolve`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] px-4 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-softest)]">
                  Close incident
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Related information</h2>

            <dl className="mt-3 divide-y divide-[var(--border)]">
              <RelatedRow label="Building" value={incident.location} />
              <RelatedRow label="Floor / Area" value={incident.floorArea ?? "Not available"} />
              <RelatedRow label="Assigned responder" value={incident.assignment?.assignee ?? "Not assigned"} />
              <RelatedRow label="Response team" value={incident.assignment?.team ?? "Not yet assigned"} />
              <RelatedRow label="Watchers" value={watchers} />
              {incident.resolutionSummary && <RelatedRow label="Resolution" value={incident.resolutionSummary} />}
            </dl>
          </section>
        </aside>
      </div>
    </IncidentPortalShell>
  );
}

export default function IncidentDetailsPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Incident details</span>}
          pageTitle="Incident details"
        >
          <DetailSkeleton />
        </IncidentPortalShell>
      }
    >
      <IncidentDetailsContent />
    </Suspense>
  );
}
