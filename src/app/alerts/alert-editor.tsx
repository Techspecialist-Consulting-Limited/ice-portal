"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  FilePenLine,
  FileText,
  ShieldCheck,
  Tag,
  UsersRound,
} from "lucide-react";
import { IceSelect, type IceSelectOption } from "@/components/ice-select";
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
  ALERT_CONFIGURED_CATEGORIES,
  ALERT_OTHER_CATEGORY,
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
import { ConfirmDialog, Toast } from "./alert-dialog";
import { IncidentPortalShell } from "../incidents/incident-shell";

const FIELD_IDS: Record<keyof AlertDraftFields, string> = {
  title: "alert-title",
  summary: "alert-summary",
  category: "alert-category",
  customCategory: "alert-customCategory",
  priority: "alert-priority",
  audience: "alert-audience",
  location: "alert-location",
  shareability: "alert-shareability",
  acknowledgementRequired: "alert-acknowledgementRequired",
  acknowledgementTargetCount: "alert-acknowledgementTargetCount",
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
    item.publishedAt ?? "",
    item.sourceIncidentId ?? "",
    item.notificationType ?? "",
  ].join("|");
}

function SelectControl({
  id,
  label,
  value,
  options,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  options: IceSelectOption[];
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <IceSelect
      id={id}
      label={label}
      hideLabel
      value={value}
      options={options}
      onChange={onChange}
      invalid={invalid}
    />
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

  const [fields, setFields] = useState<AlertDraftFields>(emptyAlertDraftFields);
  const [errors, setErrors] = useState<AlertDraftErrors>({});
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState<"draft" | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [seededKey, setSeededKey] = useState("");

  const toastTimer = useRef<number | null>(null);
  const redirectTimer = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const leaveTargetRef = useRef<string | null>(null);

  const categoryOptions = ALERT_CONFIGURED_CATEGORIES;

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
    setErrors({});
  }

  const dirty = alertDraftSignature(fields) !== baseline;

  const currentStatus = item?.status ?? "Draft";
  const canSaveAsDraft = isCreate || currentStatus === "Draft";
  const editable = isCreate || (item ? canEditAlert(item.status) : false);

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

  function validate(): AlertDraftErrors {
    return validateAlertDraft(fields);
  }

  function focusFirstError(nextErrors: AlertDraftErrors) {
    const firstKey = Object.keys(nextErrors)[0] as keyof AlertDraftFields | undefined;
    if (firstKey) document.getElementById(FIELD_IDS[firstKey] ?? `alert-${firstKey}`)?.focus();
  }

  function buildDraft(): AlertDraft {
    return {
      key,
      mode,
      alertId,
      sourceIncidentId: matchingDraft?.sourceIncidentId ?? item?.sourceIncidentId,
      notificationType: matchingDraft?.notificationType ?? item?.notificationType,
      fields,
    };
  }

  function runSaveDraft() {
    if (submittingRef.current) return;
    const nextErrors = validate();
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
      const saved = commitAlert(fields, {
        mode,
        existing: item,
        target: "draft",
        sourceIncidentId: matchingDraft?.sourceIncidentId ?? item?.sourceIncidentId,
        notificationType: matchingDraft?.notificationType ?? item?.notificationType,
      });
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
    const nextErrors = validate();
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
      <Link href="/dashboard" className="hover:text-[var(--primary)]">Home</Link>
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
              <div className="flex flex-wrap items-center justify-end gap-3">
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
                    <SelectControl
                      id="alert-category"
                      label="Category"
                      invalid={Boolean(errors.category)}
                      value={fields.category}
                      onChange={(value) => {
                        update("category", value);
                        if (value !== ALERT_OTHER_CATEGORY) update("customCategory", "");
                      }}
                      options={[
                        { value: "", label: "Choose a category", disabled: true },
                        ...categoryOptions.map((value) => ({ value, label: value })),
                        { value: ALERT_OTHER_CATEGORY, label: "Other (specify)" },
                      ]}
                    />
                  </div>
                  <FieldError id="alert-category-error" message={errors.category} />
                  <button
                    type="button"
                    onClick={() => {
                      if (fields.category === ALERT_OTHER_CATEGORY) {
                        update("category", "");
                        update("customCategory", "");
                      } else {
                        update("category", ALERT_OTHER_CATEGORY);
                        window.setTimeout(() => document.getElementById("alert-customCategory")?.focus(), 0);
                      }
                    }}
                    className="mt-1.5 text-[12px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {fields.category === ALERT_OTHER_CATEGORY ? "Choose from the list instead" : "Category not listed? Enter your own"}
                  </button>
                </div>

                {fields.category === ALERT_OTHER_CATEGORY && (
                  <div>
                    <label htmlFor="alert-customCategory" className="block text-[13px] font-semibold text-[var(--foreground)]">
                      Enter category <span className="text-[#991b1b]">*</span>
                    </label>
                    <input
                      id="alert-customCategory"
                      value={fields.customCategory}
                      onChange={(event) => update("customCategory", event.target.value)}
                      maxLength={80}
                      placeholder="e.g. Environmental hazard"
                      aria-invalid={Boolean(errors.customCategory)}
                      aria-describedby={errors.customCategory ? "alert-customCategory-error" : undefined}
                      className={cn(
                        "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                        errors.customCategory ? "border-[#d9a0a0]" : "border-[var(--border)]",
                      )}
                    />
                    <FieldError id="alert-customCategory-error" message={errors.customCategory} />
                  </div>
                )}

                <div>
                  <label htmlFor="alert-priority" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Priority <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="alert-priority"
                      label="Priority"
                      invalid={Boolean(errors.priority)}
                      value={fields.priority}
                      onChange={(value) => update("priority", value as AlertDraftFields["priority"])}
                      options={[
                        { value: "", label: "Choose a priority", disabled: true },
                        ...ALERT_PRIORITY_OPTIONS.map((value) => ({ value, label: value })),
                      ]}
                    />
                  </div>
                  <FieldError id="alert-priority-error" message={errors.priority} />
                </div>

                <div>
                  <label htmlFor="alert-shareability" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Shareability
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="alert-shareability"
                      label="Shareability"
                      value={fields.shareability}
                      onChange={(value) => update("shareability", value as AlertDraftFields["shareability"])}
                      options={[
                        ...ALERT_SHAREABILITY_OPTIONS.map((value) => ({ value, label: value })),
                        ...(fields.shareability === "Restricted"
                          ? [{ value: "Restricted", label: "Restricted (legacy)", disabled: true }]
                          : []),
                      ]}
                    />
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
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p id="alert-acknowledgement-label" className="text-[13px] font-semibold text-[var(--foreground)]">
                      Require acknowledgement
                    </p>
                    <p
                      id="alert-acknowledgement-state"
                      className={cn(
                        "mt-0.5 text-[12px] font-medium",
                        fields.acknowledgementRequired ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                      )}
                    >
                      {fields.acknowledgementRequired ? "On · Required" : "Off · Not required"}
                    </p>
                  </div>
                  <button
                    id="alert-acknowledgementRequired"
                    type="button"
                    role="switch"
                    aria-checked={fields.acknowledgementRequired}
                    aria-labelledby="alert-acknowledgement-label"
                    aria-describedby="alert-acknowledgement-state"
                    onClick={() => update("acknowledgementRequired", !fields.acknowledgementRequired)}
                    className={cn(
                      "relative inline-flex h-7 w-[50px] shrink-0 items-center rounded-full border-2 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
                      fields.acknowledgementRequired
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[#8a9a92] bg-[#8a9a92]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform motion-reduce:transition-none",
                        fields.acknowledgementRequired ? "translate-x-[22px]" : "translate-x-[2px]",
                      )}
                    />
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
                <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                  <span>Status</span>
                  <AlertStatusBadge status={isCreate ? "Draft" : currentStatus} />
                </div>
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
