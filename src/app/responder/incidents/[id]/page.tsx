"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeft,
  CircleAlert,
  Images,
  MoreHorizontal,
} from "lucide-react";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
  updateIncident,
} from "../../../incidents/incident-state";
import { IncidentTypeBadge, PriorityBadge, StatusBadge } from "../../../incidents/incident-status";
import {
  IncidentOverviewSection,
  IncidentRelatedRow,
  IncidentTimelineSection,
} from "../../../incidents/incident-detail-sections";
import { ResponderPortalShell } from "../../responder-shell";
import { canResponderAccessIncident } from "../../responder-access";
import { currentActorLabel } from "../../../auth/current-user";
import { useCurrentUser } from "../../../auth/current-user-provider";
import { ConfirmDialog } from "../../../alerts/alert-dialog";
import { escalationBlockReason } from "../../../incidents/incident-workflow";

const RESOLVABLE_STATUSES = ["Verified", "Escalated", "Broadcast"] as const;

function formatTimestamp(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionsMenu({
  evidenceHref,
  backHref,
  hasEvidence,
}: {
  evidenceHref: string;
  backHref: string;
  hasEvidence: boolean;
}) {
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
              View supporting media
            </Link>
          ) : (
            <span className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--muted-foreground)]">
              <Images className="h-4 w-4" strokeWidth={1.9} />
              No supporting media
            </span>
          )}
          <Link
            href={backHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={1.9} />
            Back to assigned incidents
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
  const currentUser = useCurrentUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const incidentId = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "");
  const incident = useIncident(incidentId);
  const [note, setNote] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionFieldError, setResolutionFieldError] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [escalationFieldError, setEscalationFieldError] = useState("");
  const [escalationMutationError, setEscalationMutationError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [confirmResolution, setConfirmResolution] = useState(false);
  const [confirmEscalation, setConfirmEscalation] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const savingActionRef = useRef(false);
  const requestedReturnTo = searchParams.get("returnTo");
  const backHref = requestedReturnTo?.startsWith("/responder/incidents?")
    ? requestedReturnTo
    : "/responder/incidents";

  useEffect(() => {
    if (!confirmEscalation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingActionRef.current) setConfirmEscalation(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmEscalation]);

  const breadcrumbs = (current: React.ReactNode) => (
    <>
      <Link href="/responder/dashboard" className="hover:text-[var(--primary)]">Responder Dashboard</Link>
      <span aria-hidden="true">/</span>
      <Link href={backHref} className="hover:text-[var(--primary)]">Assigned Incidents</Link>
      <span aria-hidden="true">/</span>
      {current}
    </>
  );

  if (!incident) {
    return (
      <ResponderPortalShell
        activeNav="assigned"
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
            href={backHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to assigned incidents
          </Link>
        </div>
      </ResponderPortalShell>
    );
  }

  // Access control: ensure incident is assigned to current responder
  if (!canResponderAccessIncident(incident, currentUser)) {
    return (
      <ResponderPortalShell
        activeNav="assigned"
        breadcrumbs={breadcrumbs(<span className="font-medium text-[var(--foreground)]">Access denied</span>)}
        pageTitle="Access denied"
        description="You do not have permission to view this incident."
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            This incident is not directly assigned to your responder account. Group-based access is not configured in the current incident model.
          </p>
          <Link
            href={backHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to assigned incidents
          </Link>
        </div>
      </ResponderPortalShell>
    );
  }

  // Only a recorded timeline is shown. Incidents without recorded events get an
  // explicit empty state rather than a synthesised "Incident reported" entry,
  // so the page never implies history that was not actually captured.
  const timeline = incident.timeline ?? [];
  const hasEvidence = Boolean(incident.evidence?.some((item) => !item.demo));
  const escalationBlock = incident.assignment?.escalated
    ? "An escalation is already recorded for this incident."
    : escalationBlockReason(incident.status);
  const canEscalate = escalationBlock === null && canResponderAccessIncident(incident, currentUser);
  const canResolve = RESOLVABLE_STATUSES.includes(incident.status as (typeof RESOLVABLE_STATUSES)[number]);
  const detailPath = `/responder/incidents/${encodeURIComponent(incident.id)}`;
  const detailHref = `${detailPath}${backHref !== "/responder/incidents" ? `?returnTo=${encodeURIComponent(backHref)}` : ""}`;
  const evidenceHref = `${detailPath}/evidence?returnTo=${encodeURIComponent(detailHref)}`;

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = note.trim();
    if (text.length < 3) {
      setActionError("Enter an operational note of at least 3 characters.");
      return;
    }
    if (savingActionRef.current) return;

    savingActionRef.current = true;
    setSavingAction(true);
    setActionError("");
    setActionSuccess("");
    try {
      const stamp = formatTimestamp(new Date());
      const updated = updateIncident(incidentId, (current) => {
        if (!canResponderAccessIncident(current, currentUser)) {
          throw new Error("This incident is no longer assigned to your responder account.");
        }
        if (current.status === "Closed" || current.status === "Rejected") {
          throw new Error("Operational notes cannot be added to a closed or rejected incident.");
        }
        return {
          ...current,
          timeline: [
            ...(current.timeline ?? []),
            { title: "Operational note added", detail: `${currentActorLabel()}: ${text}`, time: stamp },
          ],
        };
      });
      if (!updated) throw new Error("The incident could not be updated.");
      setNote("");
      setActionSuccess("Operational note added to the incident timeline.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The operational note could not be saved.");
    } finally {
      savingActionRef.current = false;
      setSavingAction(false);
    }
  };

  const requestResolution = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const summary = resolutionSummary.trim();
    if (summary.length < 10) {
      setResolutionFieldError("Enter a resolution summary of at least 10 characters.");
      return;
    }
    setResolutionFieldError("");
    setActionError("");
    setConfirmResolution(true);
  };

  const resolveIncident = () => {
    if (savingActionRef.current) return;
    const summary = resolutionSummary.trim();

    savingActionRef.current = true;
    setSavingAction(true);
    setActionError("");
    setActionSuccess("");
    try {
      const stamp = formatTimestamp(new Date());
      const updated = updateIncident(incidentId, (current) => {
        if (!canResponderAccessIncident(current, currentUser)) {
          throw new Error("This incident is no longer assigned to your responder account.");
        }
        if (!RESOLVABLE_STATUSES.includes(current.status as (typeof RESOLVABLE_STATUSES)[number])) {
          throw new Error("This incident's current status does not permit resolution.");
        }
        return {
          ...current,
          status: "Resolved",
          resolutionSummary: summary,
          resolvedAt: stamp,
          resolvedBy: currentActorLabel(),
          timeline: [
            ...(current.timeline ?? []),
            {
              title: "Incident resolved",
              detail: `${currentActorLabel()} recorded the resolution: ${summary}`,
              time: stamp,
            },
          ],
        };
      });
      if (!updated || updated.status !== "Resolved") {
        throw new Error("This incident's current status does not permit resolution.");
      }
      setConfirmResolution(false);
      setActionSuccess("Resolution saved to the shared incident record.");
    } catch (cause) {
      setConfirmResolution(false);
      setActionError(cause instanceof Error ? cause.message : "The resolution could not be saved.");
    } finally {
      savingActionRef.current = false;
      setSavingAction(false);
    }
  };

  const requestEscalation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = escalationReason.trim();
    if (!reason) {
      setEscalationFieldError("Enter a reason for escalating this incident.");
      return;
    }
    if (savingActionRef.current) return;
    setEscalationFieldError("");
    setEscalationMutationError("");
    escalateIncident();
  };

  function escalateIncident() {
    if (savingActionRef.current) return;
    const reason = escalationReason.trim();
    if (!reason) {
      setEscalationFieldError("Enter a reason for escalating this incident.");
      return;
    }

    savingActionRef.current = true;
    setSavingAction(true);
    setEscalationMutationError("");
    setActionSuccess("");
    try {
      const stamp = formatTimestamp(new Date());
      const actor = currentActorLabel();
      const updated = updateIncident(incidentId, (current) => {
        if (!canResponderAccessIncident(current, currentUser)) {
          throw new Error("This incident is no longer assigned to your responder account.");
        }
        const blockReason = current.assignment?.escalated
          ? "An escalation is already recorded for this incident."
          : escalationBlockReason(current.status);
        if (blockReason) throw new Error(blockReason);

        return {
          ...current,
          status: "Escalated",
          assignment: {
            ...current.assignment,
            escalated: true,
            escalationReason: reason,
            escalatedAt: stamp,
          },
          timeline: [
            ...(current.timeline ?? []),
            {
              title: "Incident escalated",
              detail: `Escalated by ${actor}. ${reason}`,
              time: stamp,
            },
          ],
        }
      });
      if (!updated || updated.status !== "Escalated") {
        throw new Error("The incident could not be escalated from its current status.");
      }
      setConfirmEscalation(false);
      setEscalationReason("");
      setActionSuccess("Escalation recorded on the shared incident record. No notification was sent.");
    } catch (cause) {
      setEscalationMutationError(cause instanceof Error ? cause.message : "The escalation could not be recorded.");
    } finally {
      savingActionRef.current = false;
      setSavingAction(false);
    }
  };

  return (
    <ResponderPortalShell
      activeNav="assigned"
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
          {incident.incidentType ? (
            <IncidentTypeBadge incidentType={incident.incidentType} />
          ) : (
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
              Type not recorded
            </span>
          )}
        </>
      }
    >
      <div className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to assigned incidents
        </Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <IncidentOverviewSection incident={incident} />
          <IncidentTimelineSection events={timeline} />
        </div>

        <aside className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Actions</h2>
              <ActionsMenu evidenceHref={evidenceHref} backHref={backHref} hasEvidence={hasEvidence} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {hasEvidence && (
                <Link
                  href={evidenceHref}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <Images className="h-[18px] w-[18px]" strokeWidth={2} />
                  View supporting media
                </Link>
              )}

              {!hasEvidence && (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-center text-[13px] text-[var(--muted-foreground)]">
                  No supporting media attached
                </p>
              )}
              {canEscalate ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError("");
                    setEscalationMutationError("");
                    setConfirmEscalation(true);
                  }}
                  disabled={savingAction}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e0a8a8] bg-white px-4 text-sm font-medium text-[#991b1b] transition-colors hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#991b1b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2} />
                  Escalate incident
                </button>
              ) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-[12px] leading-5 text-[var(--muted-foreground)]">
                  {escalationBlock ?? "Only the directly assigned responder can escalate this incident."}
                </p>
              )}
              <form onSubmit={saveNote} className="border-t border-[var(--border)] pt-4">
                <label htmlFor="operational-note" className="block text-[13px] font-medium text-[var(--foreground)]">
                  Add operational note
                </label>
                <textarea
                  id="operational-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  aria-describedby="operational-note-hint"
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  placeholder="Record an update for the incident timeline"
                />
                <p id="operational-note-hint" className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  Visible in the shared incident history.
                </p>
                <button
                  type="submit"
                  disabled={savingAction || incident.status === "Closed" || incident.status === "Rejected"}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingAction ? "Saving..." : "Save note"}
                </button>
              </form>
              {canResolve ? (
                <form onSubmit={requestResolution} className="border-t border-[var(--border)] pt-4">
                  <label htmlFor="resolution-summary" className="block text-[13px] font-medium text-[var(--foreground)]">
                    Resolution summary
                  </label>
                  <textarea
                    id="resolution-summary"
                    value={resolutionSummary}
                    onChange={(event) => {
                      setResolutionSummary(event.target.value);
                      setResolutionFieldError("");
                    }}
                    maxLength={1000}
                    rows={4}
                    aria-invalid={Boolean(resolutionFieldError)}
                    aria-describedby={resolutionFieldError ? "resolution-summary-error" : "resolution-summary-hint"}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    placeholder="What was done, what was the observed outcome, and is further response needed?"
                  />
                  <p id="resolution-summary-hint" className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    Record actions taken, the observed outcome, and whether further response is needed. At least 10 characters.
                  </p>
                  {resolutionFieldError && (
                    <p id="resolution-summary-error" role="alert" className="mt-2 text-[12px] text-[#991b1b]">
                      {resolutionFieldError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={savingAction}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAction ? "Saving..." : "Resolve incident"}
                  </button>
                </form>
              ) : incident.status === "Resolved" || incident.status === "Closed" ? (
                <section aria-live="polite" className="border-t border-[var(--border)] pt-4">
                  <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                    Incident {incident.status.toLowerCase()}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-[var(--foreground)]">
                    {incident.resolutionSummary || "Resolution summary not recorded."}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                    Resolved {incident.resolvedAt ?? "time not recorded"} by {incident.resolvedBy ?? "actor not recorded"}.
                  </p>
                  {incident.status === "Closed" ? (
                    <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                      Closed {incident.closedAt ?? "time not recorded"} by {incident.closedBy ?? "actor not recorded"}.
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-4 text-[var(--muted-foreground)]">
                      Closure is a separate lifecycle action and is available to Risk Administrators only.
                    </p>
                  )}
                  <Link
                    href={backHref}
                    className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to assigned incidents
                  </Link>
                </section>
              ) : (
                <p className="border-t border-[var(--border)] pt-4 text-[12px] leading-5 text-[var(--muted-foreground)]">
                  Resolution is available only for Verified, Escalated, or Broadcast incidents. This incident is currently {incident.status}.
                </p>
              )}
              {actionError && <p role="alert" className="text-[12px] text-[#991b1b]">{actionError}</p>}
              {actionSuccess && <p role="status" className="text-[12px] text-[var(--primary)]">{actionSuccess}</p>}
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Related information</h2>

            <dl className="mt-3 divide-y divide-[var(--border)]">
              <IncidentRelatedRow label="Assigned responder" value={incident.assignment?.assignee ?? "Not assigned"} />
              <IncidentRelatedRow label="Response team" value={incident.assignment?.team ?? "Not yet assigned"} />
              {incident.assignment?.escalatedAt && (
                <IncidentRelatedRow label="Escalated at" value={incident.assignment.escalatedAt} />
              )}
              {incident.assignment?.escalationReason && (
                <IncidentRelatedRow label="Escalation reason" value={incident.assignment.escalationReason} />
              )}
              {incident.floorArea && <IncidentRelatedRow label="Floor / area" value={incident.floorArea} />}
              {incident.resolutionSummary && <IncidentRelatedRow label="Resolution" value={incident.resolutionSummary} />}
            </dl>
          </section>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmResolution}
        title={`Resolve incident ${incident.id}?`}
        description={
          <span>
            This records the incident as Resolved. It will not close the incident.
            <span className="mt-2 block whitespace-pre-wrap text-[var(--foreground)]">{resolutionSummary.trim()}</span>
          </span>
        }
        confirmLabel={savingAction ? "Resolving..." : "Confirm resolution"}
        onConfirm={resolveIncident}
        onClose={() => setConfirmResolution(false)}
      />
      {confirmEscalation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingAction) setConfirmEscalation(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-escalation-title"
            className="my-auto w-full max-w-lg rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.22)]"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1f2] text-[#991b1b]">
                <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 id="incident-escalation-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                  Escalate incident
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">
                  Record why this incident needs additional internal attention. No recipient or notification routing is configured.
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Reference</dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-[var(--foreground)]">{incident.id}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Status</dt>
                <dd className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">{incident.status}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Type</dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-[var(--foreground)]">{incident.incidentType ?? "Not recorded"}</dd>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-3">
                <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Incident</dt>
                <dd className="mt-1 break-words text-[12px] font-semibold text-[var(--foreground)]">{incident.title}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Assigned to</dt>
                <dd className="mt-1 truncate text-[12px] font-semibold text-[var(--foreground)]">{incident.assignment?.assignee ?? "Not assigned"}</dd>
              </div>
            </dl>

            <form
              onSubmit={requestEscalation}
              className="mt-4"
            >
              <label htmlFor="incident-escalation-reason" className="block text-[13px] font-medium text-[var(--foreground)]">
                Escalation reason <span aria-hidden="true">*</span>
              </label>
              <textarea
                autoFocus
                id="incident-escalation-reason"
                value={escalationReason}
                onChange={(event) => {
                  setEscalationReason(event.target.value);
                  setEscalationFieldError("");
                }}
                rows={4}
                maxLength={1000}
                aria-required="true"
                aria-invalid={Boolean(escalationFieldError)}
                aria-describedby={escalationFieldError ? "incident-escalation-error" : "incident-escalation-help"}
                className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                placeholder="Explain why additional internal attention or support is needed."
              />
              {escalationFieldError ? (
                <p id="incident-escalation-error" role="alert" className="mt-1 text-[12px] text-[#991b1b]">
                  {escalationFieldError}
                </p>
              ) : (
                <p id="incident-escalation-help" className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  This reason is added to the incident assignment and timeline.
                </p>
              )}
              {escalationMutationError && (
                <p role="alert" className="mt-2 text-[12px] text-[#991b1b]">
                  {escalationMutationError}
                </p>
              )}
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#e6d6aa] bg-[#fff9e8] px-3 py-2.5 text-[12px] leading-5 text-[#75520b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Escalation routing is not configured. This records the escalation only; no stakeholder will be contacted automatically.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => setConfirmEscalation(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  {savingAction ? "Recording escalation..." : "Confirm escalation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </ResponderPortalShell>
  );
}

export default function ResponderIncidentDetailsPage() {
  return (
    <Suspense
      fallback={
        <ResponderPortalShell
          activeNav="assigned"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Incident details</span>}
          pageTitle="Incident details"
        >
          <DetailSkeleton />
        </ResponderPortalShell>
      }
    >
      <IncidentDetailsContent />
    </Suspense>
  );
}
