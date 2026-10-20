"use client";

import type {
  AlertItem,
  AlertLifecycleStatus,
  AlertNotificationType,
  AlertPriority,
  AlertShareability,
} from "@/app/dashboard/mock-data";
import { CURRENT_USER, currentActorLabel } from "@/app/auth/current-user";
import { createAlert, getNextAlertId, updateAlert } from "./alert-state";
import { formatAlertTimestamp } from "./alert-status";

// The editor and the preview screen are separate routes, so the in-progress
// alert is handed between them through this module-level draft. It lives in
// memory only (never localStorage): a full page reload intentionally loses it,
// and the preview screen reports that plainly instead of resurrecting stale
// content. Mirrors the shared-store pattern used by the alert/feed stores.
export type AlertDraftFields = {
  title: string;
  summary: string;
  category: string;
  priority: AlertPriority | "";
  audience: string;
  location: string;
  shareability: AlertShareability;
  acknowledgementRequired: boolean;
  acknowledgementTargetCount: string;
  source: string;
  // Date part only. The stored timestamp keeps its original time unless the
  // author changes the date, and publication is immediate (no scheduling).
  publicationDate: string;
};

export type AlertDraft = {
  // Identifies what the draft belongs to: "create" or `edit:${alertId}`. A draft
  // only seeds an editor/preview with a matching key, so an abandoned draft for
  // one alert never leaks into another.
  key: string;
  mode: "create" | "edit";
  alertId?: string;
  fields: AlertDraftFields;
};

export type AlertDraftErrors = Partial<Record<keyof AlertDraftFields, string>>;

// Audit entries carry the full actor label ("Mike Kanu (Risk Administrator)")
// built from the signed-in user's own record, so a role can never be stamped
// onto a name that doesn't hold it.
export const ALERT_ADMINISTRATOR = CURRENT_USER.name;

export const ALERT_PRIORITY_OPTIONS: AlertPriority[] = ["Critical", "Advisory", "Informational"];
export const ALERT_SHAREABILITY_OPTIONS: AlertShareability[] = ["Internal only", "Shareable", "Restricted"];

export const MAX_ALERT_TITLE = 90;
export const MAX_ALERT_SUMMARY = 600;

export function alertDraftKey(mode: "create" | "edit", alertId?: string) {
  return mode === "create" ? "create" : `edit:${alertId ?? ""}`;
}

export function emptyAlertDraftFields(): AlertDraftFields {
  return {
    title: "",
    summary: "",
    category: "",
    priority: "",
    audience: "",
    location: "",
    shareability: "Internal only",
    acknowledgementRequired: false,
    acknowledgementTargetCount: "",
    source: "",
    publicationDate: "",
  };
}

export function alertDraftFieldsFromItem(item: AlertItem): AlertDraftFields {
  return {
    title: item.title,
    summary: item.summary ?? "",
    category: item.category,
    priority: item.priority,
    audience: item.audience,
    location: item.location,
    shareability: item.shareability,
    acknowledgementRequired: item.acknowledgementRequired,
    acknowledgementTargetCount: item.acknowledgementTargetCount
      ? String(item.acknowledgementTargetCount)
      : "",
    source: item.source,
    publicationDate: item.publishedAt ? item.publishedAt.slice(0, 10) : "",
  };
}

// Stable signature of the draft fields, used both to detect unsaved changes and
// to re-seed the editor when a restored draft arrives after hydration.
export function alertDraftSignature(fields: AlertDraftFields): string {
  return [
    fields.title,
    fields.summary,
    fields.category,
    fields.priority,
    fields.audience,
    fields.location,
    fields.shareability,
    fields.acknowledgementRequired ? "1" : "0",
    fields.acknowledgementTargetCount,
    fields.source,
    fields.publicationDate,
  ].join("|");
}

let draft: AlertDraft | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function subscribeToAlertDraft(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getAlertDraftSnapshot(): AlertDraft | null {
  return draft;
}

export function getAlertDraftServerSnapshot(): AlertDraft | null {
  return null;
}

export function readAlertDraft(): AlertDraft | null {
  return draft;
}

export function writeAlertDraft(next: AlertDraft) {
  draft = next;
  notifySubscribers();
}

export function clearAlertDraft() {
  if (draft === null) return;
  draft = null;
  notifySubscribers();
}

// --- Validation ------------------------------------------------------------

export function validateAlertDraft(
  fields: AlertDraftFields,
  target: "draft" | "publish",
  today: string,
): AlertDraftErrors {
  const next: AlertDraftErrors = {};
  const title = fields.title.trim();
  if (!title) next.title = "Add a title for this alert.";
  else if (title.length < 4) next.title = "Use a title of at least 4 characters.";

  if (!fields.summary.trim()) next.summary = "Add the message staff will read. This is required.";
  if (!fields.category) next.category = "Choose a category.";
  if (!fields.priority) next.priority = "Choose a priority.";
  if (!fields.audience.trim()) next.audience = "Say who this alert is for.";
  if (!fields.location.trim()) next.location = "Record the location this alert applies to.";
  if (!fields.source) next.source = "Choose the source for this alert.";

  if (fields.acknowledgementRequired) {
    const count = Number(fields.acknowledgementTargetCount);
    if (!fields.acknowledgementTargetCount.trim()) {
      next.acknowledgementTargetCount = "Enter how many people must acknowledge this alert.";
    } else if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
      next.acknowledgementTargetCount = "Enter a whole number greater than zero.";
    }
  }

  if (target === "publish" && fields.publicationDate && today && fields.publicationDate > today) {
    next.publicationDate = "Publishing takes effect immediately — choose today or an earlier date.";
  }

  return next;
}

// --- Persistence -----------------------------------------------------------

// Lifecycle transition applied when the author commits. A draft remains a draft;
// publishing a brand-new or draft alert makes it Published, re-publishing an
// already-live alert records it as Updated, and an alert that is mid-acknowledge
// or escalated keeps that state so its tracking is not silently reset.
function resolveStatus(
  target: "draft" | "publish",
  mode: "create" | "edit",
  existing: AlertItem | null | undefined,
): AlertLifecycleStatus {
  if (target === "draft") return "Draft";
  if (mode === "create" || !existing) return "Published";
  const current = existing.status;
  if (current === "Draft") return "Published";
  if (current === "Published") return "Updated";
  return current;
}

// The status the alert will hold once committed. Exposed so the review screen can
// state plainly what publishing will do before the author commits to it.
export function previewAlertStatus(
  target: "draft" | "publish",
  mode: "create" | "edit",
  existing: AlertItem | null | undefined,
): AlertLifecycleStatus {
  return resolveStatus(target, mode, existing);
}

function resolvePublishedAt(
  status: AlertLifecycleStatus,
  fields: AlertDraftFields,
  existing: AlertItem | null | undefined,
  nowIso: string,
): string | undefined {
  const isPublishedState = status !== "Draft";
  if (!isPublishedState) return existing?.publishedAt;
  const existingDate = existing?.publishedAt ? existing.publishedAt.slice(0, 10) : undefined;
  if (fields.publicationDate && fields.publicationDate !== existingDate) {
    return `${fields.publicationDate}T00:00:00Z`;
  }
  return existing?.publishedAt ?? nowIso;
}

function buildHistory(
  status: AlertLifecycleStatus,
  mode: "create" | "edit",
  existing: AlertItem | null | undefined,
  stamp: string,
): AlertItem["history"] {
  const entries = [...(existing?.history ?? [])];
  if (mode === "create") {
    entries.push({
      title: status === "Published" ? "Alert published" : "Draft created",
      detail:
        status === "Published"
          ? `Published by ${currentActorLabel()}.`
          : `Draft created by ${currentActorLabel()}. Not yet published.`,
      time: stamp,
    });
    return entries;
  }

  const previousStatus = existing?.status;
  entries.push({
    title: "Alert updated",
    detail: `Updated by ${currentActorLabel()}.`,
    time: stamp,
  });
  if (status === "Published" && previousStatus === "Draft") {
    entries.push({
      title: "Alert published",
      detail: `Published by ${currentActorLabel()}.`,
      time: stamp,
    });
  }
  return entries;
}

// Persist the draft fields as an alert. Shared by the editor's "Save draft" and
// the preview screen's "Publish", so both routes write through one code path.
export function commitAlert(
  fields: AlertDraftFields,
  options: {
    mode: "create" | "edit";
    existing?: AlertItem | null;
    target: "draft" | "publish";
    // Optional provenance, supplied by the incident conversion screen. Preserved
    // across edits when omitted, so re-saving a converted alert keeps its link.
    sourceIncidentId?: string;
    notificationType?: AlertNotificationType;
  },
): AlertItem | undefined {
  const { mode, existing = null, target } = options;
  const nowIso = new Date().toISOString();
  const stamp = formatAlertTimestamp(nowIso);
  const status = resolveStatus(target, mode, existing);

  const common = {
    title: fields.title.trim(),
    summary: fields.summary.trim() || undefined,
    category: fields.category,
    priority: fields.priority as AlertPriority,
    audience: fields.audience.trim(),
    location: fields.location.trim(),
    shareability: fields.shareability,
    acknowledgementRequired: fields.acknowledgementRequired,
    acknowledgementTargetCount: fields.acknowledgementRequired
      ? Number(fields.acknowledgementTargetCount)
      : undefined,
    // Counts are only meaningful once an alert is live and tracked. They are set
    // to zero on first publish so the interface never shows invented progress.
    acknowledgedCount:
      existing?.acknowledgedCount ?? (status === "Draft" ? undefined : 0),
    source: fields.source,
    notificationType: options.notificationType ?? existing?.notificationType,
    sourceIncidentId: options.sourceIncidentId ?? existing?.sourceIncidentId,
    updatedAt: nowIso,
  };

  if (mode === "create" || !existing) {
    return createAlert({
      ...common,
      id: getNextAlertId(),
      status,
      publishedAt: resolvePublishedAt(status, fields, existing, nowIso),
      createdBy: ALERT_ADMINISTRATOR,
      publishedBy: status === "Draft" ? undefined : ALERT_ADMINISTRATOR,
      history: buildHistory(status, mode, existing, stamp),
    });
  }

  return updateAlert(existing.id, (current) => ({
    ...current,
    ...common,
    status,
    publishedAt: resolvePublishedAt(status, fields, current, nowIso),
    publishedBy: status === "Draft" ? current.publishedBy : current.publishedBy ?? ALERT_ADMINISTRATOR,
    createdBy: current.createdBy ?? ALERT_ADMINISTRATOR,
    history: buildHistory(status, mode, current, stamp),
  }));
}
