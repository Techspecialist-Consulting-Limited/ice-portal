"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleX,
  Images,
  Megaphone,
  MoreHorizontal,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../incident-state";
import { IncidentTypeBadge, PriorityBadge, StatusBadge } from "../incident-status";
import {
  IncidentOverviewSection,
  IncidentRelatedRow,
  IncidentTimelineSection,
} from "../incident-detail-sections";
import { IncidentPortalShell } from "../incident-shell";
import { IncidentMapBanner } from "../incident-map-banner";

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
  const hasEvidence = Boolean(incident.evidence && incident.evidence.length > 0);
  const watchers = incident.watchers != null
    ? `${incident.watchers} administrator${incident.watchers === 1 ? "" : "s"}`
    : "Not available";

  return (
    <IncidentPortalShell
      breadcrumbs={breadcrumbs(<span className="font-medium text-[var(--foreground)]">{incident.id}</span>)}
      pageTitle={incident.title}
      titleClassName="text-[30px] leading-[36px]"
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
          <IncidentTypeBadge incidentType={incident.incidentType} />
        </>
      }
      topContent={
        <IncidentMapBanner
          incidentId={incident.id}
          incidentType={incident.incidentType}
          location={incident.location}
          floorArea={incident.floorArea}
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <IncidentOverviewSection incident={incident} />
          <IncidentTimelineSection events={timeline} />
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
              <IncidentRelatedRow label="Building" value={incident.location} />
              <IncidentRelatedRow label="Floor / Area" value={incident.floorArea ?? "Not available"} />
              <IncidentRelatedRow label="Assigned responder" value={incident.assignment?.assignee ?? "Not assigned"} />
              <IncidentRelatedRow label="Response team" value={incident.assignment?.team ?? "Not yet assigned"} />
              <IncidentRelatedRow label="Watchers" value={watchers} />
              {incident.resolutionSummary && <IncidentRelatedRow label="Resolution" value={incident.resolutionSummary} />}
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
