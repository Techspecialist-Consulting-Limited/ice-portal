"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  FilePenLine,
  FileText,
  Info,
  ListChecks,
  MapPin,
  ShieldCheck,
  Tag,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import type { AlertItem } from "@/app/dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "./alert-state";
import {
  ALERT_PRIORITY_OPTIONS,
  ALERT_SHAREABILITY_OPTIONS,
  MAX_ALERT_SUMMARY,
  MAX_ALERT_TITLE,
  alertDraftFieldsFromItem,
  alertDraftKey,
  alertDraftSignature,
  clearAlertDraft,
  commitAlert,
  emptyAlertDraftFields,
  getAlertDraftServerSnapshot,
  getAlertDraftSnapshot,
  subscribeToAlertDraft,
  validateAlertDraft,
  writeAlertDraft,
  type AlertDraft,
  type AlertDraftErrors,
  type AlertDraftFields,
} from "./alert-draft";
import { AlertStatusBadge, canEditAlert } from "./alert-status";
import { PriorityBadge } from "../incidents/incident-status";
import { ConfirmDialog, Toast } from "./alert-dialog";
import { IncidentPortalShell } from "../incidents/incident-shell";

const FIELD_IDS: Record<keyof AlertDraftFields, string> = {
  title: "alert-title",
  summary: "alert-summary",
  category: "alert-category",
  priority: "alert-priority",
  audience: "alert-audience",
  location: "alert-location",
  shareability: "alert-shareability",
  acknowledgementRequired: "alert-acknowledgementRequired",
  acknowledgementTargetCount: "alert-acknowledgementTargetCount",
  source: "alert-source",
  publicationDate: "alert-publicationDate",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function alertItemSignature(item: AlertItem) {
  return [
    item.id,
    item.title,
    item.summary ?? "",
    item.category,
    item.priority,
    item.status,
    item.audience,
    item.location,
    item.shareability,
    item.acknowledgementRequired ? "1" : "0",
    item.acknowledgementTargetCount ?? "",
    item.source,
    item.publishedAt ?? "",
  ].join("|");
}

function SelectControl({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <span className="relative block">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 pr-9 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={2} />
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {message}
    </p>
  );
}

export function AlertEditor({ mode, alertId }: { mode: "create" | "edit"; alertId?: string }) {
  const router = useRouter();
  const isCreate = mode === "create";
  const key = alertDraftKey(mode, alertId);

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  const item = !isCreate && alertId ? alertList.find((entry) => entry.id === alertId) ?? null : null;

  const draft = useSyncExternalStore(
    subscribeToAlertDraft,
    getAlertDraftSnapshot,
    getAlertDraftServerSnapshot,
  );
  const matchingDraft = draft && draft.key === key ? draft : null;
  const draftMatches = matchingDraft !== null;

  // Resolved on the client only, so prerendered markup never depends on the clock.
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const [fields, setFields] = useState<AlertDraftFields>(emptyAlertDraftFields);
  const [errors, setErrors] = useState<AlertDraftErrors>({});
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState<"draft" | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [seededKey, setSeededKey] = useState("");
  const [restored, setRestored] = useState(false);

  const toastTimer = useRef<number | null>(null);
  const redirectTimer = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const leaveTargetRef = useRef<string | null>(null);

  const categoryOptions = useMemo(() => {
    const values = new Set(alertList.map((entry) => entry.category));
    if (item?.category) values.add(item.category);
    return Array.from(values).sort();
  }, [alertList, item]);

  const sourceOptions = useMemo(() => {
    const values = new Set(alertList.map((entry) => entry.source));
    if (item?.source) values.add(item.source);
    return Array.from(values).sort();
  }, [alertList, item]);

  // Re-seed the editable fields when the underlying record or a restored draft
  // resolves (no effect-setState): matches the Security Feed editor pattern.
  const seedKey = isCreate
    ? matchingDraft
      ? `create:${alertDraftSignature(matchingDraft.fields)}`
      : "create"
    : item
      ? matchingDraft
        ? `${alertItemSignature(item)}:draft`
        : alertItemSignature(item)
      : `loading:${alertId ?? ""}`;

  if (seededKey !== seedKey) {
    const seedFields = matchingDraft
      ? matchingDraft.fields
      : isCreate || !item
        ? emptyAlertDraftFields()
        : alertDraftFieldsFromItem(item);
    setSeededKey(seedKey);
    setFields(seedFields);
    setBaseline(alertDraftSignature(seedFields));
    setRestored(draftMatches);
    setErrors({});
  }

  const dirty = alertDraftSignature(fields) !== baseline;

  const currentStatus = item?.status ?? "Draft";
  const canSaveAsDraft = isCreate || currentStatus === "Draft";
  const editable = isCreate || (item ? canEditAlert(item.status) : false);

  const today = now !== null ? new Date(now).toISOString().slice(0, 10) : "";

  const detailHref = item ? `/alerts/${encodeURIComponent(item.id)}` : "/alerts";
  const previewHref = isCreate
    ? "/alerts/new/preview"
    : `/alerts/${encodeURIComponent(alertId ?? "")}/edit/preview`;

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const update = <K extends keyof AlertDraftFields>(field: K, value: AlertDraftFields[K]) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  function validate(target: "draft" | "publish"): AlertDraftErrors {
    return validateAlertDraft(fields, target, today);
  }

  function focusFirstError(nextErrors: AlertDraftErrors) {
    const firstKey = Object.keys(nextErrors)[0] as keyof AlertDraftFields | undefined;
    if (firstKey) document.getElementById(FIELD_IDS[firstKey] ?? `alert-${firstKey}`)?.focus();
  }

  function buildDraft(): AlertDraft {
    return { key, mode, alertId, fields };
  }

  function runSaveDraft() {
    if (submittingRef.current) return;
    const nextErrors = validate("draft");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveError("");
      focusFirstError(nextErrors);
      return;
    }

    setSaveError("");
    submittingRef.current = true;
    setSubmitting("draft");
    try {
      const saved = commitAlert(fields, { mode, existing: item, target: "draft" });
      if (!saved) throw new Error("Alert could not be saved");
      clearAlertDraft();
      setBaseline(alertDraftSignature(fields));
      showToast(`${saved.id} was saved as a draft.`, "success");
      redirectTimer.current = window.setTimeout(
        () => router.push(`/alerts/${encodeURIComponent(saved.id)}`),
        900,
      );
    } catch {
      submittingRef.current = false;
      setSubmitting(null);
      setSaveError("We couldn't save this draft. Nothing was changed — please try again.");
    }
  }

  function goToReview() {
    const nextErrors = validate("publish");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveError("");
      focusFirstError(nextErrors);
      return;
    }
    setSaveError("");
    writeAlertDraft(buildDraft());
    router.push(previewHref);
  }

  function requestLeave(href: string) {
    if (!dirty) {
      clearAlertDraft();
      router.push(href);
      return;
    }
    leaveTargetRef.current = href;
    setConfirmLeave(true);
  }

  function confirmLeaveAction() {
    setConfirmLeave(false);
    clearAlertDraft();
    const href = leaveTargetRef.current;
    leaveTargetRef.current = null;
    if (href) router.push(href);
  }

  const notFound = !isCreate && !item && seededKey === `loading:${alertId ?? ""}`;

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
      {item && (
        <>
          <span aria-hidden="true">/</span>
          <Link href={detailHref} className="hover:text-[var(--primary)]">{item.id}</Link>
        </>
      )}
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">{isCreate ? "Create alert" : "Edit"}</span>
    </>
  );

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={breadcrumbs}
      pageTitle={isCreate ? "Create alert" : "Edit alert"}
      description={
        isCreate
          ? "Draft a new security alert or advisory, then review it before publishing."
          : item
            ? `${item.id} · ${item.category}`
            : "Update an existing alert or advisory."
      }
      actions={
        <button
          type="button"
          onClick={() => requestLeave(detailHref)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          Back
        </button>
      }
    >
      {notFound ? (
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            No alert matches the reference{" "}
            <span className="font-medium text-[var(--foreground)]">{alertId || "provided"}</span>. It may
            have been removed or the reference may be incorrect.
          </p>
          <Link
            href="/alerts"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to Alerts &amp; Advisories
          </Link>
        </div>
      ) : !editable && item ? (
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            <span className="font-medium text-[var(--foreground)]">{item.id}</span> is{" "}
            <span className="font-medium text-[var(--foreground)]">{item.status.toLowerCase()}</span> and is
            retained as history. It cannot be edited.
          </p>
          <Link
            href={detailHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back to {item.id}
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
          {/* Left column — the alert's message */}
          <div className="space-y-4">
            {restored && (
              <p className="flex items-start gap-2 rounded-xl border border-[#cfe0f5] bg-[#eef4fd] px-3 py-2.5 text-[12px] leading-5 text-[#1d4ed8]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>Restored the alert you were reviewing. Nothing is saved until you save a draft or publish.</span>
              </p>
            )}

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <FileText className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Alert message
              </h2>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                The title and the message staff will read when this alert is issued.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="alert-title" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Title <span className="text-[#991b1b]">*</span>
                  </label>
                  <input
                    id="alert-title"
                    type="text"
                    value={fields.title}
                    onChange={(event) => update("title", event.target.value.slice(0, MAX_ALERT_TITLE))}
                    maxLength={MAX_ALERT_TITLE}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? "alert-title-error" : undefined}
                    placeholder="Short, specific title staff will recognise"
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.title ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <FieldError id="alert-title-error" message={errors.title} />
                    <p aria-live="polite" className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                      {fields.title.length} / {MAX_ALERT_TITLE}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="alert-summary" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Message <span className="text-[#991b1b]">*</span>
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    What is happening, what it means, and what staff should do. Plain text only.
                  </p>
                  <textarea
                    id="alert-summary"
                    value={fields.summary}
                    onChange={(event) => update("summary", event.target.value.slice(0, MAX_ALERT_SUMMARY))}
                    rows={7}
                    maxLength={MAX_ALERT_SUMMARY}
                    aria-invalid={errors.summary ? true : undefined}
                    aria-describedby={errors.summary ? "alert-summary-error" : undefined}
                    placeholder="Write the message staff will read."
                    className={cn(
                      "mt-2 min-h-[170px] w-full resize-y rounded-xl border bg-[var(--muted)] px-3.5 py-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.summary ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <FieldError id="alert-summary-error" message={errors.summary} />
                    <p aria-live="polite" className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                      {fields.summary.length} / {MAX_ALERT_SUMMARY}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="alert-audience" className="block text-[13px] font-semibold text-[var(--foreground)]">
                      Audience <span className="text-[#991b1b]">*</span>
                    </label>
                    <input
                      id="alert-audience"
                      type="text"
                      value={fields.audience}
                      onChange={(event) => update("audience", event.target.value)}
                      aria-invalid={errors.audience ? true : undefined}
                      aria-describedby={errors.audience ? "alert-audience-error" : undefined}
                      placeholder="e.g. Abuja HQ staff, All staff"
                      className={cn(
                        "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                        errors.audience ? "border-[#d9a0a0]" : "border-[var(--border)]",
                      )}
                    />
                    <FieldError id="alert-audience-error" message={errors.audience} />
                  </div>

                  <div>
                    <label htmlFor="alert-location" className="block text-[13px] font-semibold text-[var(--foreground)]">
                      Location <span className="text-[#991b1b]">*</span>
                    </label>
                    <input
                      id="alert-location"
                      type="text"
                      value={fields.location}
                      onChange={(event) => update("location", event.target.value)}
                      aria-invalid={errors.location ? true : undefined}
                      aria-describedby={errors.location ? "alert-location-error" : undefined}
                      placeholder="e.g. Abuja HQ, Lagos office"
                      className={cn(
                        "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                        errors.location ? "border-[#d9a0a0]" : "border-[var(--border)]",
                      )}
                    />
                    <FieldError id="alert-location-error" message={errors.location} />
                  </div>
                </div>
              </div>
            </section>

            {saveError && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                {saveError}
              </p>
            )}

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-2 rounded-xl border border-[#f0d8b8] bg-[#fff4d6] px-3 py-2.5 text-[12px] leading-5 text-[#9a6700]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>
                  Publishing takes effect immediately. There is no scheduling or attachment upload in this
                  release, and publishing does not send push, email or in-app notifications &mdash; it records the
                  alert and makes it active.
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={() => requestLeave(detailHref)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                {canSaveAsDraft && (
                  <button
                    type="button"
                    onClick={runSaveDraft}
                    disabled={submitting !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <FilePenLine className="h-[18px] w-[18px]" strokeWidth={2} />
                    {submitting === "draft" ? "Saving…" : "Save draft"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={goToReview}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                >
                  <ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={2} />
                  Review alert
                </button>
              </div>
            </section>
          </div>

          {/* Right column — classification, acknowledgement and publication */}
          <aside className="space-y-4">
            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <Tag className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Classification
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="alert-category" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Category <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl id="alert-category" value={fields.category} onChange={(value) => update("category", value)}>
                      <option value="" disabled>Choose a category</option>
                      {categoryOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </SelectControl>
                  </div>
                  <FieldError id="alert-category-error" message={errors.category} />
                </div>

                <div>
                  <label htmlFor="alert-priority" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Priority <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl id="alert-priority" value={fields.priority} onChange={(value) => update("priority", value as AlertDraftFields["priority"])}>
                      <option value="" disabled>Choose a priority</option>
                      {ALERT_PRIORITY_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </SelectControl>
                  </div>
                  <FieldError id="alert-priority-error" message={errors.priority} />
                </div>

                <div>
                  <label htmlFor="alert-source" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Source <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl id="alert-source" value={fields.source} onChange={(value) => update("source", value)}>
                      <option value="" disabled>Choose a source</option>
                      {sourceOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </SelectControl>
                  </div>
                  <FieldError id="alert-source-error" message={errors.source} />
                </div>

                <div>
                  <label htmlFor="alert-shareability" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Shareability
                  </label>
                  <div className="mt-2">
                    <SelectControl id="alert-shareability" value={fields.shareability} onChange={(value) => update("shareability", value as AlertDraftFields["shareability"])}>
                      {ALERT_SHAREABILITY_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </SelectControl>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Recorded as a label only &mdash; sharing is not enforced.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <UsersRound className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Acknowledgement
              </h2>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Require recipients to confirm they have seen this alert. The acknowledgement target is recorded
                with the alert, and no notice is sent to recipients.
              </p>

              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">Require acknowledgement</p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                      {fields.acknowledgementRequired ? "Recipients must confirm." : "Not required."}
                    </p>
                  </div>
                  <button
                    id="alert-acknowledgementRequired"
                    type="button"
                    role="switch"
                    aria-checked={fields.acknowledgementRequired}
                    aria-label="Require acknowledgement"
                    onClick={() => update("acknowledgementRequired", !fields.acknowledgementRequired)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      fields.acknowledgementRequired
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                    )}
                  >
                    {fields.acknowledgementRequired ? "Required" : "Not required"}
                  </button>
                </div>

                {fields.acknowledgementRequired && (
                  <div>
                    <label htmlFor="alert-acknowledgementTargetCount" className="block text-[13px] font-semibold text-[var(--foreground)]">
                      Target recipients <span className="text-[#991b1b]">*</span>
                    </label>
                    <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                      How many people must acknowledge. The acknowledged count starts at 0.
                    </p>
                    <input
                      id="alert-acknowledgementTargetCount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={fields.acknowledgementTargetCount}
                      onChange={(event) => update("acknowledgementTargetCount", event.target.value)}
                      aria-invalid={errors.acknowledgementTargetCount ? true : undefined}
                      aria-describedby={errors.acknowledgementTargetCount ? "alert-acknowledgementTargetCount-error" : undefined}
                      placeholder="e.g. 250"
                      className={cn(
                        "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                        errors.acknowledgementTargetCount ? "border-[#d9a0a0]" : "border-[var(--border)]",
                      )}
                    />
                    <FieldError id="alert-acknowledgementTargetCount-error" message={errors.acknowledgementTargetCount} />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <CalendarClock className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Publication
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="alert-publicationDate" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Publication date
                  </label>
                  <input
                    id="alert-publicationDate"
                    type="date"
                    value={fields.publicationDate}
                    onChange={(event) => update("publicationDate", event.target.value)}
                    aria-invalid={errors.publicationDate ? true : undefined}
                    aria-describedby={errors.publicationDate ? "alert-publicationDate-error" : "alert-publicationDate-hint"}
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.publicationDate ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <FieldError id="alert-publicationDate-error" message={errors.publicationDate} />
                  <p id="alert-publicationDate-hint" className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                    Left blank, the alert records the current date when published. Publication is immediate —
                    there is no scheduling.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                  <span>Status</span>
                  <AlertStatusBadge status={isCreate ? "Draft" : currentStatus} />
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <ListChecks className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Review step
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">Review alert</span> opens a preview of the
                alert as staff will see it, where you can go back to edit or publish.{" "}
                <span className="font-medium text-[var(--foreground)]">Save draft</span> stores the alert now
                without publishing it. Nothing is published until you choose Publish on the review screen.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {fields.priority && <PriorityBadge priority={fields.priority as AlertItem["priority"]} />}
                {fields.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {fields.location.trim() || "No location"}
                  </span>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Discard changes?"
        description="You have unsaved changes to this alert. Leaving now will discard them."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={confirmLeaveAction}
        onClose={() => setConfirmLeave(false)}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
