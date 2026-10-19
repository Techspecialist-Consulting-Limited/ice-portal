"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { getIncidentStateServerSnapshot, getIncidentStateSnapshot, subscribeToIncidentState, updateIncident } from "../../incident-state";
import { IncidentPortalShell } from "../../incident-shell";
import { ConfirmDialog, Toast } from "@/app/alerts/alert-dialog";
import { currentActorLabel } from "@/app/auth/current-user";

const ACTOR = currentActorLabel();
const RESOLVABLE_STATUSES = ["Verified", "Escalated", "Broadcast"];

function formatTimestamp(date: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function IncidentResolutionContent({ incidentId }: { incidentId: string }) {
  const incidents = useSyncExternalStore(subscribeToIncidentState, getIncidentStateSnapshot, getIncidentStateServerSnapshot);
  const incident = incidents.find((record) => record.id === incidentId) ?? null;
  const [summary, setSummary] = useState(incident?.resolutionSummary ?? "");
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [toast, setToast] = useState("");

  const breadcrumb = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>
      <span aria-hidden="true">/</span>
      {incident ? (
        <Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="hover:text-[var(--primary)]">{incident.id}</Link>
      ) : (
        <span>Incident</span>
      )}
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">Resolution</span>
    </>
  );

  if (!incident) {
    return (
      <IncidentPortalShell breadcrumbs={breadcrumb} pageTitle="Incident not found" description="The requested incident could not be located.">
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-6">
          <p className="text-sm text-[var(--muted-foreground)]">No incident matches reference {incidentId || "provided"}.</p>
          <Link href="/incidents" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
            <ArrowLeft className="h-4 w-4" /> Return to queue
          </Link>
        </section>
      </IncidentPortalShell>
    );
  }

  const canResolve = RESOLVABLE_STATUSES.includes(incident.status);
  const canClose = incident.status === "Resolved";

  const saveResolution = () => {
    const resolutionSummary = summary.trim();
    if (resolutionSummary.length < 10) {
      setError("Enter a meaningful resolution summary of at least 10 characters.");
      return;
    }

    try {
      const stamp = formatTimestamp(new Date());
      const updated = updateIncident(incident.id, (current) => {
        if (!RESOLVABLE_STATUSES.includes(current.status)) throw new Error("Incident status no longer permits resolution.");
        return {
          ...current,
          status: "Resolved",
          resolutionSummary,
          resolvedAt: stamp,
          resolvedBy: ACTOR,
          timeline: [
            ...(current.timeline ?? []),
            { title: "Incident resolved", detail: `${ACTOR} recorded the resolution: ${resolutionSummary}`, time: stamp },
          ],
        };
      });
      if (!updated || updated.status !== "Resolved") throw new Error("Incident status no longer permits resolution.");
      setError("");
      setToast("Resolution saved to the incident record.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The resolution could not be saved.");
    }
  };

  const closeIncident = () => {
    try {
      const stamp = formatTimestamp(new Date());
      const updated = updateIncident(incident.id, (current) => {
        if (current.status !== "Resolved") throw new Error("Only resolved incidents can be closed.");
        return {
          ...current,
          status: "Closed",
          closedAt: stamp,
          closedBy: ACTOR,
          timeline: [
            ...(current.timeline ?? []),
            { title: "Incident closed", detail: `Closed by ${ACTOR}.`, time: stamp },
          ],
        };
      });
      if (!updated || updated.status !== "Closed") throw new Error("Only resolved incidents can be closed.");
      setConfirmClose(false);
      setToast("Incident closed and retained in the record.");
    } catch (cause) {
      setConfirmClose(false);
      setError(cause instanceof Error ? cause.message : "The incident could not be closed.");
    }
  };

  return (
    <IncidentPortalShell
      breadcrumbs={breadcrumb}
      pageTitle={canClose ? "Close incident" : "Resolve incident"}
      titleClassName="text-[32px] leading-[38px]"
      description={<span>{incident.title} · {incident.id}</span>}
      actions={
        <Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> Back to incident
        </Link>
      }
    >
      <section className="max-w-3xl rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            {canClose ? <LockKeyhole className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{canClose ? "Confirm closure" : "Resolution summary"}</h2>
            <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">
              {canClose
                ? "Only resolved incidents can be closed. Closure retains the incident and its timeline for reporting."
                : "Record the outcome before resolving. This action changes incident status and adds an event to its timeline."}
            </p>
          </div>
        </div>

        {canClose ? (
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Recorded resolution</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--foreground)]">{incident.resolutionSummary || "Not recorded"}</p>
            <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Resolved {incident.resolvedAt ?? "time not recorded"} by {incident.resolvedBy ?? "actor not recorded"}</p>
          </div>
        ) : canResolve ? (
          <div className="mt-5">
            <label htmlFor="resolution-summary" className="block text-[13px] font-medium text-[var(--foreground)]">Resolution summary</label>
            <textarea
              id="resolution-summary"
              rows={5}
              value={summary}
              onChange={(event) => {
                setSummary(event.target.value);
                setError("");
              }}
              maxLength={1000}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "resolution-error" : "resolution-hint"}
              className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              placeholder="Summarize actions taken and the outcome..."
            />
            <p id="resolution-hint" className="mt-1 text-[12px] text-[var(--muted-foreground)]">{summary.trim().length}/1000 characters · at least 10 required</p>
            {error && <p id="resolution-error" role="alert" className="mt-2 text-[13px] text-[#991b1b]">{error}</p>}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 text-[13px] leading-5 text-[var(--muted-foreground)]">
            This incident is {incident.status}. Resolution is available only after it has been verified, escalated, or broadcast.
          </p>
        )}

        {(canResolve || canClose) && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {canResolve && (
              <button type="button" onClick={saveResolution} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                <CheckCircle2 className="h-4 w-4" /> Save resolution
              </button>
            )}
            {canClose && (
              <button type="button" onClick={() => setConfirmClose(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                <LockKeyhole className="h-4 w-4" /> Close incident
              </button>
            )}
          </div>
        )}
      </section>
      <Toast message={toast} />
      <ConfirmDialog
        open={confirmClose}
        title="Close this incident?"
        description="The incident will move from Resolved to Closed and remain available for reports and audit."
        confirmLabel="Close incident"
        onConfirm={closeIncident}
        onClose={() => setConfirmClose(false)}
      />
    </IncidentPortalShell>
  );
}
