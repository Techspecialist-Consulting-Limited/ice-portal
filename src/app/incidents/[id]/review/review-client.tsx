"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CircleCheck,
  CircleX,
  Flame,
  MapPin,
  UserRound,
} from "lucide-react";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
  updateIncident,
} from "../../incident-state";
import { PriorityBadge, StatusBadge } from "../../incident-status";
import { IncidentPortalShell } from "../../incident-shell";
import { CURRENT_USER } from "../../../auth/current-user";

export type ReviewDecision = "verify" | "reject";

const MAX_NOTE_LENGTH = 500;
const REVIEWER = CURRENT_USER.name;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTimestamp(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryField({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
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

function DecisionCard({
  value,
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  value: ReviewDecision;
  icon: typeof Flame;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (value: ReviewDecision) => void;
}) {
  const isVerify = value === "verify";

  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-[14px] border p-4 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)] has-[:focus-visible]:ring-offset-2",
        selected
          ? isVerify
            ? "border-[var(--primary)] bg-[#eaf7ee]"
            : "border-[#d9a0a0] bg-[#fdecec]"
          : "border-[var(--border)] bg-white hover:bg-[var(--muted)]",
      )}
    >
      <input
        type="radio"
        name="review-decision"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isVerify ? "bg-[#e3f2e8] text-[#087443]" : "bg-[#fbe0e0] text-[#991b1b]",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--foreground)]">{title}</span>
          <span
            aria-hidden="true"
            className={cn(
              "ml-auto flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
              selected ? (isVerify ? "border-[var(--primary)]" : "border-[#c62828]") : "border-[var(--border)]",
            )}
          >
            {selected && (
              <span className={cn("h-[10px] w-[10px] rounded-full", isVerify ? "bg-[var(--primary)]" : "bg-[#c62828]")} />
            )}
          </span>
        </span>
        <span className="mt-1 block text-[12px] leading-5 text-[var(--muted-foreground)]">{description}</span>
      </span>
    </label>
  );
}

export function ReviewPageContent({
  incidentId,
  requestedDecision,
}: {
  incidentId: string;
  requestedDecision: ReviewDecision | null;
}) {
  const router = useRouter();

  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const incident = incidents.find((item) => item.id === incidentId) ?? null;

  const [decision, setDecision] = useState<ReviewDecision | null>(requestedDecision);
  const [lastRequested, setLastRequested] = useState<ReviewDecision | null>(requestedDecision);
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Preselect when the incident-details action explicitly requested a decision.
  if (lastRequested !== requestedDecision) {
    setLastRequested(requestedDecision);
    setDecision(requestedDecision);
  }

  const handleSelect = (value: ReviewDecision) => {
    setDecision(value);
    setDecisionError("");
  };

  const handleNoteChange = (value: string) => {
    const next = value.slice(0, MAX_NOTE_LENGTH);
    setNote(next);
    if (next.trim()) setNoteError("");
  };

  const handleConfirm = () => {
    if (submittingRef.current || !incident) return;

    const chosen = decision;
    const trimmedNote = note.trim();
    let invalid = false;

    if (!chosen) {
      setDecisionError("Select Verify incident or Reject report before confirming.");
      invalid = true;
    } else {
      setDecisionError("");
    }

    if (!trimmedNote) {
      setNoteError("Add a review note before confirming your decision.");
      invalid = true;
    } else {
      setNoteError("");
    }

    if (invalid || !chosen) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSaveError("");

    try {
      const isVerify = chosen === "verify";
      const updated = updateIncident(incident.id, (current) => ({
        ...current,
        status: isVerify ? "Verified" : "Rejected",
        reviewStatus: "Completed",
        reviewNote: trimmedNote,
        reviewer: REVIEWER,
        timeline: [
          ...(current.timeline ?? []),
          {
            title: isVerify ? "Incident verified" : "Report rejected",
            detail: `${trimmedNote} — Decision recorded by ${REVIEWER} (Risk Administrator).`,
            time: formatTimestamp(new Date()),
          },
        ],
      }));

      if (!updated) throw new Error("Incident could not be updated");

      router.push(`/incidents/${incident.id}`);
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setSaveError("We couldn't save your decision. Your note has been kept — please try again.");
    }
  };

  if (!incident) {
    return (
      <IncidentPortalShell
        breadcrumbs={
          <>
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/incidents">Incidents</Link>
            <span>/</span>
            <span className="font-medium text-[var(--foreground)]">Not found</span>
          </>
        }
        pageTitle="Incident not found"
        description="The requested incident could not be located."
        actions={
          <Link
            href="/incidents"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to queue
          </Link>
        }
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            This review cannot be opened because no incident matches the reference{" "}
            <span className="font-medium text-[var(--foreground)]">{incidentId || "provided"}</span>.
          </p>
          <Link
            href="/incidents"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to the incident queue
          </Link>
        </div>
      </IncidentPortalShell>
    );
  }

  return (
    <IncidentPortalShell
      breadcrumbs={
        <>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/incidents">Incidents</Link>
          <span>/</span>
          <Link href={`/incidents/${incident.id}`}>{incident.id}</Link>
          <span>/</span>
          <span className="font-medium text-[var(--foreground)]">Review</span>
        </>
      }
      pageTitle="Review decision"
      description="Verify the incident details or reject the report. Add a review note to record your decision."
      actions={
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
      }
    >
      <div className="space-y-4">
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident summary</h2>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fee2e2] text-[#991b1b]">
                <Flame className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold leading-6 text-[var(--foreground)]">{incident.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{incident.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>Reported {incident.reported}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PriorityBadge priority={incident.priority} />
              <StatusBadge status={incident.status} />
            </div>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryField icon={Flame} label="Category" value={incident.category} />
            <SummaryField icon={MapPin} label="Location" value={incident.location} />
            <SummaryField icon={UserRound} label="Reported by" value={incident.reporter ?? "Not available"} />
            <SummaryField icon={Building2} label="Department" value={incident.department ?? "Not available"} />
          </div>
        </section>

        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 id="decision-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
            Your decision
          </h2>

          <div
            role="radiogroup"
            aria-labelledby="decision-heading"
            aria-describedby={decisionError ? "decision-error" : undefined}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <DecisionCard
              value="verify"
              icon={CircleCheck}
              title="Verify incident"
              description="Confirm the incident details are valid and move it forward for response."
              selected={decision === "verify"}
              onSelect={handleSelect}
            />
            <DecisionCard
              value="reject"
              icon={CircleX}
              title="Reject report"
              description="Reject the report if it is inaccurate, duplicated, or not a valid incident."
              selected={decision === "reject"}
              onSelect={handleSelect}
            />
          </div>

          {decisionError && (
            <p id="decision-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {decisionError}
            </p>
          )}

          <div className="mt-5">
            <label htmlFor="review-note" className="block text-[13px] font-semibold text-[var(--foreground)]">
              Review note <span className="font-normal text-[var(--muted-foreground)]">(required)</span>
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(event) => handleNoteChange(event.target.value)}
              rows={4}
              maxLength={MAX_NOTE_LENGTH}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={cn("review-note-hint", "review-note-count", noteError && "review-note-error")}
              placeholder="Add a brief note about your decision, e.g. findings, next steps, or why the report is invalid..."
              className={cn(
                "mt-2 w-full resize-y rounded-xl border bg-[var(--muted)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                noteError ? "border-[#d9a0a0]" : "border-[var(--border)]",
              )}
            />

            <div className="mt-1.5 flex items-start justify-between gap-3">
              <p id="review-note-hint" className="text-[11px] text-[var(--muted-foreground)]">
                Required for verification and rejection. Maximum {MAX_NOTE_LENGTH} characters.
              </p>
              <p
                id="review-note-count"
                aria-live="polite"
                className="shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]"
              >
                {note.length} / {MAX_NOTE_LENGTH}
              </p>
            </div>

            {noteError && (
              <p id="review-note-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {noteError}
              </p>
            )}
          </div>

          {saveError && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {saveError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => router.push(`/incidents/${incident.id}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Saving decision…" : "Confirm decision"}
            </button>
          </div>
        </section>
      </div>
    </IncidentPortalShell>
  );
}
