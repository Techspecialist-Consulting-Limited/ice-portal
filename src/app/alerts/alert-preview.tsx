"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CircleAlert,
  FilePenLine,
  Info,
  MapPin,
  Megaphone,
  Send,
  ShieldCheck,
  Tag,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "./alert-state";
import {
  alertDraftKey,
  clearAlertDraft,
  commitAlert,
  getAlertDraftServerSnapshot,
  getAlertDraftSnapshot,
  previewAlertStatus,
  subscribeToAlertDraft,
  validateAlertDraft,
} from "./alert-draft";
import { AlertStatusBadge, formatAlertRate, formatAlertTimestamp } from "./alert-status";
import { currentActorLabel } from "../auth/current-user";
import { PriorityBadge } from "../incidents/incident-status";
import { ConfirmDialog, Toast } from "./alert-dialog";
import { IncidentPortalShell } from "../incidents/incident-shell";

function MetaField({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

// False on the server and during the hydration render, true once mounted. The
// draft lives in memory only, so the server snapshot is always null; this gate
// keeps the "no draft" message from flashing before the client can read the real
// value — a false "nothing to review" claim would be misleading.
const subscribeNever = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-32 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
      ))}
    </div>
  );
}

function formatPublicationDate(value: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return formatAlertTimestamp(`${value}T00:00:00Z`);
}

export function AlertPreview({ mode, alertId }: { mode: "create" | "edit"; alertId?: string }) {
  const router = useRouter();
  const isCreate = mode === "create";
  const key = alertDraftKey(mode, alertId);
  const isClient = useIsClient();

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  const existing = !isCreate && alertId ? alertList.find((entry) => entry.id === alertId) ?? null : null;

  const draft = useSyncExternalStore(
    subscribeToAlertDraft,
    getAlertDraftSnapshot,
    getAlertDraftServerSnapshot,
  );
  const matchingDraft = draft && draft.key === key ? draft : null;

  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  const today = now !== null ? new Date(now).toISOString().slice(0, 10) : "";

  const [pendingPublish, setPendingPublish] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "publish" | null>(null);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const toastTimer = useRef<number | null>(null);
  const redirectTimer = useRef<number | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  const editorHref = isCreate
    ? "/alerts/new"
    : `/alerts/${encodeURIComponent(alertId ?? "")}/edit`;

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
      {existing && (
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/alerts/${encodeURIComponent(existing.id)}`} className="hover:text-[var(--primary)]">{existing.id}</Link>
        </>
      )}
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">Review</span>
    </>
  );

  function backToEdit() {
    router.push(editorHref);
  }

  function runCommit(target: "draft" | "publish") {
    if (!matchingDraft || submittingRef.current) return;
    const fields = matchingDraft.fields;

    const errors = validateAlertDraft(fields, target, today);
    if (Object.keys(errors).length > 0) {
      setActionError(
        "This alert is missing required details, so it can't be saved yet. Go back to edit and complete the highlighted fields.",
      );
      setPendingPublish(false);
      return;
    }

    setActionError("");
    submittingRef.current = true;
    setSubmitting(target);
    try {
      const saved = commitAlert(fields, { mode, existing, target });
      if (!saved) throw new Error("Alert could not be saved");
      clearAlertDraft();
      showToast(
        target === "publish" ? `${saved.id} was published.` : `${saved.id} was saved as a draft.`,
        "success",
      );
      setPendingPublish(false);
      redirectTimer.current = window.setTimeout(
        () => router.push(`/alerts/${encodeURIComponent(saved.id)}`),
        900,
      );
    } catch {
      submittingRef.current = false;
      setSubmitting(null);
      setPendingPublish(false);
      setActionError(
        target === "publish"
          ? "We couldn't publish this alert. Nothing was changed — please try again."
          : "We couldn't save this draft. Nothing was changed — please try again.",
      );
    }
  }

  const canSaveAsDraft = isCreate || existing?.status === "Draft";

  // The preview only renders once a matching draft exists. A missing draft (for
  // example after a page reload, since the draft is held in memory only) is
  // reported honestly rather than shown as an empty or half-built alert.
  if (!isClient) {
    return (
      <IncidentPortalShell
        activeNav="alerts"
        breadcrumbs={breadcrumbs}
        pageTitle="Review alert"
        description="Review the alert before publishing it."
      >
        <PreviewSkeleton />
      </IncidentPortalShell>
    );
  }

  if (!matchingDraft) {
    return (
      <IncidentPortalShell
        activeNav="alerts"
        breadcrumbs={breadcrumbs}
        pageTitle="Review alert"
        description="Review the alert before publishing it."
        actions={
          <Link
            href={editorHref}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to edit
          </Link>
        }
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4d6] text-[#9a6700]">
            <TriangleAlert className="h-5 w-5" strokeWidth={2} />
          </span>
          <h2 className="mt-3 text-[16px] font-semibold text-[var(--foreground)]">Draft not available</h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-5 text-[var(--muted-foreground)]">
            There is no alert draft to review. A draft is held only while you work through the create or edit
            form, so a page reload clears it. Nothing has been published or changed.
          </p>
          <Link
            href={editorHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            {isCreate ? "Start a new alert" : "Back to edit alert"}
          </Link>
        </div>
      </IncidentPortalShell>
    );
  }

  const fields = matchingDraft.fields;
  const reference = existing?.id ?? "New alert";
  const projectedStatus = previewAlertStatus("publish", mode, existing);
  const acknowledgementRate = fields.acknowledgementRequired
    ? fields.acknowledgementTargetCount.trim()
      ? 0
      : null
    : null;
  const acknowledgementTarget = fields.acknowledgementRequired
    ? Number(fields.acknowledgementTargetCount) || 0
    : 0;

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={breadcrumbs}
      pageTitle="Review alert"
      description={
        isCreate
          ? "Check how this alert will read before you publish it."
          : `Check the changes to ${existing?.id ?? alertId ?? "this alert"} before you publish.`
      }
      actions={
        <button
          type="button"
          onClick={backToEdit}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          Back to edit
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        {/* Left column — the alert as staff will see it */}
        <div className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Megaphone className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold leading-6 text-[var(--foreground)]">
                    {fields.title.trim() || <span className="text-[var(--muted-foreground)]">Untitled alert</span>}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--muted-foreground)]">
                    <span className="font-medium text-[var(--foreground)]">{reference}</span>
                    <span aria-hidden="true">·</span>
                    <span>{fields.source || "No source"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fields.priority && <PriorityBadge priority={fields.priority} />}
                <AlertStatusBadge status={projectedStatus} />
              </div>
            </div>

            <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetaField icon={Tag} label="Category" value={fields.category || "Not set"} />
              <MetaField icon={UsersRound} label="Audience" value={fields.audience.trim() || "Not set"} />
              <MetaField icon={MapPin} label="Location" value={fields.location.trim() || "Not set"} />
              <MetaField icon={ShieldCheck} label="Shareability" value={fields.shareability} />
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Message</h2>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--foreground)]">
              {fields.summary.trim() || <span className="text-[var(--muted-foreground)]">No message yet.</span>}
            </p>

            <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetaField
                icon={CalendarClock}
                label="Publication date"
                value={formatPublicationDate(fields.publicationDate, "Current date on publish")}
              />
              <MetaField
                icon={CalendarClock}
                label="Last updated"
                value={isCreate ? "Not saved yet" : formatAlertTimestamp(existing?.updatedAt)}
              />
              <MetaField
                icon={Building2}
                label={isCreate ? "Author" : "Published by"}
                value={existing?.publishedBy ?? existing?.createdBy ?? currentActorLabel()}
              />
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Acknowledgement</h2>
            {!fields.acknowledgementRequired ? (
              <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                Acknowledgement is not required for this alert.
              </p>
            ) : acknowledgementRate === null ? (
              <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                Acknowledgement is required but no target has been set.
              </p>
            ) : (
              <div className="mt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Targeted</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">{acknowledgementTarget}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Acknowledged</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">0</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Outstanding</p>
                    <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">{acknowledgementTarget}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[13px] text-[var(--foreground)]">
                    <span>Acknowledgement rate</span>
                    <span className="font-medium tabular-nums">{formatAlertRate(acknowledgementRate)}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: "0%" }} />
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
                  Counts start at zero and rise as recipients record acknowledgements. None have been recorded
                  for this draft yet.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right column — publish controls */}
        <aside className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Publish</h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted-foreground)]">
              Publishing records the alert and makes it active. It does not send push, email or in-app
              notifications.
            </p>

            <dl className="mt-4 space-y-3 border-t border-[var(--border)] pt-4 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">Reference</dt>
                <dd className="font-medium text-[var(--foreground)]">{isCreate ? "Assigned on save" : reference}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">Status after publishing</dt>
                <dd>
                  <AlertStatusBadge status={projectedStatus} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-foreground)]">Shareability</dt>
                <dd className="font-medium text-[var(--foreground)]">{fields.shareability}</dd>
              </div>
            </dl>

            {actionError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-[12px] leading-5 text-[#991b1b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                {actionError}
              </p>
            )}

            <div className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setPendingPublish(true)}
                disabled={submitting !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={2} />
                {submitting === "publish"
                  ? "Publishing…"
                  : projectedStatus === "Updated"
                    ? "Publish changes"
                    : "Publish alert"}
              </button>
              {canSaveAsDraft && (
                <button
                  type="button"
                  onClick={() => runCommit("draft")}
                  disabled={submitting !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FilePenLine className="h-[18px] w-[18px]" strokeWidth={2} />
                  {submitting === "draft" ? "Saving…" : "Save draft"}
                </button>
              )}
              <button
                type="button"
                onClick={backToEdit}
                disabled={submitting !== null}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                Back to edit
              </button>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-2 rounded-xl border border-[#cfe0f5] bg-[#eef4fd] px-3 py-2.5 text-[12px] leading-5 text-[#1d4ed8]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <span>
                Publishing success here means the alert was recorded and made active. It does not mean any push,
                email or in-app notification was delivered.
              </span>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingPublish}
        title={projectedStatus === "Updated" ? "Publish changes" : "Publish alert"}
        description={
          <>
            This will {isCreate ? "publish a new alert" : `publish changes to ${reference}`}. It becomes active
            to its audience ({fields.audience.trim() || "no audience set"}). Publishing is immediate and no
            notification is sent to recipients.
          </>
        }
        confirmLabel="Publish alert"
        tone="primary"
        onConfirm={() => runCommit("publish")}
        onClose={() => setPendingPublish(false)}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
