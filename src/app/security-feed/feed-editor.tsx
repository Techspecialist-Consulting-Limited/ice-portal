"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  FilePenLine,
  FileText,
  Newspaper,
  Pin,
  PinOff,
  Send,
  ShieldCheck,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { IceSelect, type IceSelectOption } from "@/components/ice-select";
import type {
  AlertShareability,
  FeedItem,
  FeedLifecycleStatus,
  FeedPriority,
} from "@/app/dashboard/mock-data";
import { feedSources } from "@/app/dashboard/mock-data";
import {
  createFeedItem,
  getFeedStateServerSnapshot,
  getFeedStateSnapshot,
  getNextFeedId,
  subscribeToFeedState,
  updateFeedItem,
} from "./feed-state";
import { FeedPriorityBadge, FeedStatusBadge, formatFeedTimestamp, sourceTypeLabel } from "./feed-status";
import { ConfirmDialog, Toast } from "../alerts/alert-dialog";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { CURRENT_USER, currentActorLabel } from "../auth/current-user";

const ADMINISTRATOR = CURRENT_USER.name;
const SHAREABILITY_OPTIONS: AlertShareability[] = ["Internal only", "Shareable", "Restricted"];
const PRIORITY_OPTIONS: FeedPriority[] = ["Critical", "Advisory", "Informational"];
const MAX_SUMMARY = 180;
const MAX_CONTENT = 2000;

// Maps a form-state key to the DOM id of its input, so a failed validation can
// move focus to the first field that needs attention.
const FIELD_IDS: Record<keyof FormState, string> = {
  title: "feed-title",
  summary: "feed-summary",
  content: "feed-content",
  category: "feed-category",
  sourceName: "feed-source",
  audience: "feed-audience",
  shareability: "feed-shareability",
  priority: "feed-priority",
  pinned: "feed-pinned",
  publicationDate: "feed-publicationDate",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type FormState = {
  title: string;
  summary: string;
  content: string;
  category: string;
  sourceName: string;
  audience: string;
  shareability: AlertShareability;
  priority: FeedPriority | "";
  pinned: boolean;
  publicationDate: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function emptyForm(): FormState {
  return {
    title: "",
    summary: "",
    content: "",
    category: "",
    sourceName: "",
    audience: "",
    shareability: "Internal only",
    priority: "",
    pinned: false,
    publicationDate: "",
  };
}

function formFromItem(item: FeedItem): FormState {
  return {
    title: item.title,
    summary: item.summary ?? "",
    content: item.content ?? "",
    category: item.category,
    sourceName: item.source,
    audience: item.audience ?? "",
    shareability: item.shareability ?? "Internal only",
    priority: item.priority ?? "",
    pinned: item.pinned,
    // Only the date part is captured in the form; the stored timestamp keeps its
    // original time unless the author changes the date.
    publicationDate: item.publishedAt ? item.publishedAt.slice(0, 10) : "",
  };
}

// Stable signature of the stored record, used to re-seed the form when the
// underlying item resolves (server seed -> client localStorage) or changes.
function itemSignature(item: FeedItem) {
  return [
    item.id,
    item.title,
    item.summary ?? "",
    item.content ?? "",
    item.category,
    item.source,
    item.audience ?? "",
    item.shareability ?? "",
    item.priority ?? "",
    item.pinned ? "1" : "0",
    item.status,
    item.publishedAt ?? "",
  ].join("|");
}

// Stable signature of the current form values, used for the unsaved-changes guard.
function formSignature(form: FormState) {
  return [
    form.title,
    form.summary,
    form.content,
    form.category,
    form.sourceName,
    form.audience,
    form.shareability,
    form.priority,
    form.pinned ? "1" : "0",
    form.publicationDate,
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

export function FeedEditor({ mode, feedId }: { mode: "create" | "edit"; feedId?: string }) {
  const router = useRouter();
  const isCreate = mode === "create";

  const feedList = useSyncExternalStore(
    subscribeToFeedState,
    getFeedStateSnapshot,
    getFeedStateServerSnapshot,
  );
  const item = feedId ? feedList.find((entry) => entry.id === feedId) ?? null : null;

  // Resolved on the client only, so the prerendered markup never depends on the
  // current clock. Used for validation of "future" dates and the current date.
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [audience, setAudience] = useState("");
  const [shareability, setShareability] = useState<AlertShareability>("Internal only");
  const [priority, setPriority] = useState<FeedPriority | "">("");
  const [pinned, setPinned] = useState(false);
  const [publicationDate, setPublicationDate] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState<"secondary" | "publish" | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [seededKey, setSeededKey] = useState("");

  const toastTimer = useRef<number | null>(null);
  const redirectTimer = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const leaveTargetRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  // Re-seed the editable fields when the underlying item resolves or changes,
  // matching the assignment page's derived-state pattern (no effect-setState).
  const seedKey = isCreate ? "create" : item ? itemSignature(item) : `loading:${feedId ?? ""}`;
  if (seededKey !== seedKey) {
    const seed = isCreate || !item ? emptyForm() : formFromItem(item);
    setSeededKey(seedKey);
    setTitle(seed.title);
    setSummary(seed.summary);
    setContent(seed.content);
    setCategory(seed.category);
    setSourceName(seed.sourceName);
    setAudience(seed.audience);
    setShareability(seed.shareability);
    setPriority(seed.priority);
    setPinned(seed.pinned);
    setPublicationDate(seed.publicationDate);
    setBaseline(formSignature(seed));
    setErrors({});
  }

  const currentSignature = formSignature({
    title,
    summary,
    content,
    category,
    sourceName,
    audience,
    shareability,
    priority,
    pinned,
    publicationDate,
  });
  const dirty = currentSignature !== baseline;

  const currentStatus: FeedLifecycleStatus = item?.status ?? "Draft";
  const secondaryLabel = currentStatus === "Published" ? "Save changes" : "Save draft";

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const categoryOptions = useMemo(() => {
    const fromRecords = new Set(feedList.map((entry) => entry.category));
    if (item?.category) fromRecords.add(item.category);
    return Array.from(fromRecords).sort();
  }, [feedList, item]);

  const internalSources = useMemo(() => feedSources.filter((entry) => entry.type === "Internal"), []);
  const externalSources = useMemo(() => feedSources.filter((entry) => entry.type === "External"), []);
  const hasCustomSource = Boolean(
    item?.source && !feedSources.some((entry) => entry.name === item.source),
  );

  const selectedSource = feedSources.find((entry) => entry.name === sourceName) ?? null;
  const previewSourceType = selectedSource?.type ?? item?.sourceType ?? "Internal";
  const previewStatus: FeedLifecycleStatus = isCreate ? "Draft" : currentStatus;

  const today = now !== null ? new Date(now).toISOString().slice(0, 10) : "";

  const detailHref = item ? `/security-feed/${encodeURIComponent(item.id)}` : "/security-feed";

  function validate(target: "secondary" | "publish"): FormErrors {
    const next: FormErrors = {};
    if (!title.trim()) next.title = "Add a title for this feed item.";
    else if (title.trim().length < 4) next.title = "Use a title of at least 4 characters.";
    if (!content.trim()) next.content = "Add the item content — this is the body staff will read.";
    if (!category) next.category = "Choose a category from the configured list.";
    if (!sourceName) next.sourceName = "Choose the source for this item.";
    if (target === "publish" && publicationDate && today && publicationDate > today) {
      next.publicationDate = "Publishing takes effect immediately — choose today or an earlier date.";
    }
    return next;
  }

  function resolvePublishedAt(status: FeedLifecycleStatus, nowIso: string): string | undefined {
    if (status !== "Published") return item?.publishedAt;
    const existingDate = item?.publishedAt ? item.publishedAt.slice(0, 10) : undefined;
    if (publicationDate && publicationDate !== existingDate) return `${publicationDate}T00:00:00Z`;
    return item?.publishedAt ?? nowIso;
  }

  function buildHistory(status: FeedLifecycleStatus, stamp: string) {
    const existing = item?.history ?? [];
    const entries = [...existing];
    if (isCreate) {
      entries.push({
        title: "Draft created",
        detail: `Created by ${currentActorLabel()}.`,
        time: stamp,
      });
    } else {
      entries.push({
        title: "Item updated",
        detail: `Updated by ${currentActorLabel()}.`,
        time: stamp,
      });
    }
    if (status === "Published" && currentStatus !== "Published") {
      entries.push({
        title: "Item published",
        detail: `Published to the Security Feed by ${currentActorLabel()}.`,
        time: stamp,
      });
    }
    return entries;
  }

  function commit(status: FeedLifecycleStatus): FeedItem | undefined {
    const nowIso = new Date().toISOString();
    const stamp = formatFeedTimestamp(nowIso);
    const common = {
      title: title.trim(),
      summary: summary.trim() || undefined,
      content: content.trim() || undefined,
      category,
      source: sourceName,
      sourceType: selectedSource?.type ?? item?.sourceType ?? "Internal",
      audience: audience.trim() || undefined,
      shareability,
      priority: priority === "" ? undefined : priority,
      pinned,
      updatedAt: nowIso,
    };

    if (isCreate) {
      const id = getNextFeedId();
      return createFeedItem({
        ...common,
        id,
        status,
        publishedAt: resolvePublishedAt(status, nowIso),
        createdBy: ADMINISTRATOR,
        publishedBy: status === "Published" ? ADMINISTRATOR : undefined,
        history: buildHistory(status, stamp),
      });
    }

    if (!item) return undefined;
    return updateFeedItem(item.id, (current) => ({
      ...current,
      ...common,
      status,
      publishedAt: resolvePublishedAt(status, nowIso),
      publishedBy: status === "Published" ? current.publishedBy ?? ADMINISTRATOR : current.publishedBy,
      history: buildHistory(status, stamp),
    }));
  }

  function runSave(target: "secondary" | "publish") {
    if (submittingRef.current) return;

    const nextErrors = validate(target);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveError("");
    const firstKey = Object.keys(nextErrors)[0] as keyof FormState;
    document.getElementById(FIELD_IDS[firstKey] ?? `feed-${firstKey}`)?.focus();
    return;
    }

    setSaveError("");
    submittingRef.current = true;
    setSubmitting(target);

    try {
      const status: FeedLifecycleStatus = target === "publish" ? "Published" : isCreate ? "Draft" : currentStatus;
      const saved = commit(status);
      if (!saved) throw new Error("Feed item could not be saved");

      setBaseline(currentSignature);
      showToast(
        target === "publish" ? `${saved.id} was published.` : `${saved.id} was saved.`,
        "success",
      );
      setConfirmPublish(false);
      redirectTimer.current = window.setTimeout(() => router.push(detailHrefFor(saved.id)), 900);
    } catch {
      submittingRef.current = false;
      setSubmitting(null);
      setSaveError(
        target === "publish"
          ? "We couldn't publish this item. Nothing was changed — please try again."
          : "We couldn't save this item. Nothing was changed — please try again.",
      );
      setConfirmPublish(false);
    }
  }

  function detailHrefFor(id: string) {
    return `/security-feed/${encodeURIComponent(id)}`;
  }

  function requestLeave(href: string) {
    if (!dirty) {
      router.push(href);
      return;
    }
    leaveTargetRef.current = href;
    setConfirmLeave(true);
  }

  function confirmLeaveAction() {
    setConfirmLeave(false);
    const href = leaveTargetRef.current;
    leaveTargetRef.current = null;
    if (href) router.push(href);
  }

  const notFound = !isCreate && !item && seededKey === `loading:${feedId ?? ""}`;

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/security-feed" className="hover:text-[var(--primary)]">Security Feed</Link>
      {item && (
        <>
          <span aria-hidden="true">/</span>
          <Link href={detailHref} className="hover:text-[var(--primary)]">{item.id}</Link>
        </>
      )}
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">{isCreate ? "Create feed item" : "Edit"}</span>
    </>
  );

  return (
    <IncidentPortalShell
      activeNav="security-feed"
      breadcrumbs={breadcrumbs}
      pageTitle={isCreate ? "Create feed item" : "Edit feed item"}
      description={
        isCreate
          ? "Draft or publish a new security update or awareness item."
          : item
            ? `${item.id} · ${item.category}`
            : "Update an existing security feed item."
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
            No feed item matches the reference{" "}
            <span className="font-medium text-[var(--foreground)]">{feedId || "provided"}</span>. It may
            have been removed or the reference may be incorrect.
          </p>
          <Link
            href="/security-feed"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to Security Feed
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
          {/* Left column — the item's content */}
          <div className="space-y-4">
            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <FileText className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Item content
              </h2>
              <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
                The title, short summary and full body staff will see in the Security Feed.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="feed-title" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Title <span className="text-[#991b1b]">*</span>
                  </label>
                  <input
                    id="feed-title"
                    type="text"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? "feed-title-error" : undefined}
                    placeholder="Short, specific title staff will recognise"
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.title ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <FieldError id="feed-title-error" message={errors.title} />
                </div>

                <div>
                  <label htmlFor="feed-summary" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Summary
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Optional. The one-line blurb shown in feed lists.
                  </p>
                  <textarea
                    id="feed-summary"
                    value={summary}
                    onChange={(event) => setSummary(event.target.value.slice(0, MAX_SUMMARY))}
                    rows={2}
                    maxLength={MAX_SUMMARY}
                    placeholder="One line summarising the item for list views."
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[var(--muted-foreground)]">Optional. Maximum {MAX_SUMMARY} characters.</p>
                    <p aria-live="polite" className="shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                      {summary.length} / {MAX_SUMMARY}
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="feed-content" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Content <span className="text-[#991b1b]">*</span>
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    The full body of the item. Plain text only.
                  </p>
                  <textarea
                    id="feed-content"
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value.slice(0, MAX_CONTENT));
                      if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                    rows={9}
                    maxLength={MAX_CONTENT}
                    aria-invalid={errors.content ? true : undefined}
                    aria-describedby={errors.content ? "feed-content-error" : undefined}
                    placeholder="Write the full message staff will read: what is happening, what it means, and what to do."
                    className={cn(
                      "mt-2 min-h-[220px] w-full resize-y rounded-xl border bg-[var(--muted)] px-3.5 py-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.content ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <FieldError id="feed-content-error" message={errors.content} />
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[var(--muted-foreground)]">Required. Maximum {MAX_CONTENT} characters.</p>
                    <p aria-live="polite" className="shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                      {content.length} / {MAX_CONTENT}
                    </p>
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
                  Publishing takes effect immediately. There is no future scheduling or attachment upload in this
                  release, and publishing does not send any external notification &mdash; the item is recorded and
                  made visible to staff.
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
                <button
                  type="button"
                  onClick={() => runSave("secondary")}
                  disabled={submitting !== null}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FilePenLine className="h-[18px] w-[18px]" strokeWidth={2} />
                  {submitting === "secondary" ? "Saving…" : secondaryLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={submitting !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Send className="h-[18px] w-[18px]" strokeWidth={2} />
                  Publish now
                </button>
              </div>
            </section>
          </div>

          {/* Right column — classification, publication and live preview */}
          <aside className="space-y-4">
            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <Tag className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Classification
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="feed-category" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Category <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="feed-category"
                      label="Category"
                      invalid={Boolean(errors.category)}
                      value={category}
                      onChange={(value) => {
                        setCategory(value);
                        if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                      }}
                      options={[
                        { value: "", label: "Choose a category", disabled: true },
                        ...categoryOptions.map((value) => ({ value, label: value })),
                      ]}
                    />
                  </div>
                  <FieldError id="feed-category-error" message={errors.category} />
                </div>

                <div>
                  <label htmlFor="feed-source" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Source <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="feed-source"
                      label="Source"
                      invalid={Boolean(errors.sourceName)}
                      value={sourceName}
                      onChange={(value) => {
                        setSourceName(value);
                        if (errors.sourceName) setErrors((prev) => ({ ...prev, sourceName: undefined }));
                      }}
                      options={[
                        { value: "", label: "Choose a source", disabled: true },
                        ...(hasCustomSource && item?.source
                          ? [{ value: item.source, label: `${item.source} (recorded)` }]
                          : []),
                        ...internalSources.map((entry) => ({
                          value: entry.name,
                          label: entry.name,
                          group: "Internal sources",
                        })),
                        ...externalSources.map((entry) => ({
                          value: entry.name,
                          label: entry.name,
                          group: "Approved external sources",
                        })),
                      ]}
                    />
                  </div>
                  <FieldError id="feed-source-error" message={errors.sourceName} />
                  {selectedSource && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      {sourceTypeLabel(selectedSource.type)}
                      {selectedSource.owner ? ` · owner ${selectedSource.owner}` : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="feed-audience" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Audience
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Optional. Who this item is intended for.
                  </p>
                  <input
                    id="feed-audience"
                    type="text"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    placeholder="e.g. All staff, Lagos office staff"
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
                  />
                </div>

                <div>
                  <label htmlFor="feed-shareability" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Shareability
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="feed-shareability"
                      label="Shareability"
                      value={shareability}
                      onChange={(value) => setShareability(value as AlertShareability)}
                      options={SHAREABILITY_OPTIONS.map((value) => ({ value, label: value }))}
                    />
                  </div>
                  <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                    How far this content may be shared. Recorded as a label only &mdash; sharing is not enforced.
                  </p>
                </div>

                <div>
                  <label htmlFor="feed-priority" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Priority
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    Optional. Only set where the item carries a severity.
                  </p>
                  <div className="mt-2">
                    <SelectControl
                      id="feed-priority"
                      label="Priority"
                      value={priority}
                      onChange={(value) => setPriority(value as FeedPriority | "")}
                      options={[
                        { value: "", label: "No priority" },
                        ...PRIORITY_OPTIONS.map((value) => ({ value, label: value })),
                      ]}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <CalendarClock className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Publication
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="feed-publicationDate" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Publication date
                  </label>
                  <input
                    id="feed-publicationDate"
                    type="date"
                    value={publicationDate}
                    onChange={(event) => {
                      setPublicationDate(event.target.value);
                      if (errors.publicationDate) setErrors((prev) => ({ ...prev, publicationDate: undefined }));
                    }}
                    aria-invalid={errors.publicationDate ? true : undefined}
                    aria-describedby={errors.publicationDate ? "feed-publicationDate-error" : "feed-publicationDate-hint"}
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.publicationDate ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <FieldError id="feed-publicationDate-error" message={errors.publicationDate} />
                  <p id="feed-publicationDate-hint" className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                    Left blank, the item records the current date when you publish. Publication is
                    immediate — there is no scheduling.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">Pin to top</p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">Show this item at the top of the feed.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pinned}
                    aria-label="Pin to top"
                    onClick={() => setPinned((value) => !value)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      pinned
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                    )}
                  >
                    {pinned ? <PinOff className="h-4 w-4" strokeWidth={2} /> : <Pin className="h-4 w-4" strokeWidth={2} />}
                    {pinned ? "Pinned" : "Pin"}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                  <span>Status</span>
                  <FeedStatusBadge status={previewStatus} />
                </div>
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <Newspaper className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Live preview
              </h2>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Reflects what you have entered. Nothing is saved until you publish or save a draft.
              </p>

              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
                <div className="flex items-center gap-2">
                  {pinned && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                      <Pin className="h-3 w-3" strokeWidth={2} />
                      Pinned
                    </span>
                  )}
                  <FeedPriorityBadge priority={priority || undefined} />
                </div>

                <h3 className="mt-2 text-[15px] font-semibold leading-5 text-[var(--foreground)]">
                  {title.trim() || <span className="text-[var(--muted-foreground)]">Untitled item</span>}
                </h3>

                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--muted-foreground)]">
                  {category || <span>No category</span>}
                  <span aria-hidden="true">·</span>
                  {sourceName || <span>No source</span>}
                  {sourceName && <span>· {sourceTypeLabel(previewSourceType)}</span>}
                </p>

                {(summary.trim() || content.trim()) && (
                  <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-[var(--foreground)]">
                    {summary.trim() || content.trim()}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--muted-foreground)]">
                  {audience.trim() && <span>Audience: {audience.trim()}</span>}
                  <span>Shareability: {shareability}</span>
                  {publicationDate && <span>Date: {publicationDate}</span>}
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title="Publish feed item"
        description={
          <>
            This will publish{" "}
            <span className="font-medium text-[var(--foreground)]">{item?.id ?? "this new item"}</span> to
            the Security Feed. It becomes visible to staff. Publishing is immediate and no external
            notification is sent.
          </>
        }
        confirmLabel="Publish item"
        tone="primary"
        onConfirm={() => runSave("publish")}
        onClose={() => setConfirmPublish(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard changes?"
        description="You have unsaved changes to this feed item. Leaving now will discard them."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={confirmLeaveAction}
        onClose={() => setConfirmLeave(false)}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
