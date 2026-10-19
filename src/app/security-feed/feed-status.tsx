import type { FeedLifecycleStatus, FeedPriority, FeedSourceType } from "@/app/dashboard/mock-data";
import { ToneBadge, incidentPriorityTone, type IncidentTone } from "../incidents/incident-status";

export type FeedTone = IncidentTone;

// Single source of truth for feed lifecycle semantics. The summary cards, the
// status filter, badges and the dashboard all derive from here so a feed state
// is never described two ways. Lifecycle is kept separate from source type —
// a Published item may originate from an External source.
const feedStatusToneMap: Record<FeedLifecycleStatus, FeedTone> = {
  Draft: "neutral",
  Published: "success",
  Withdrawn: "neutral",
  Archived: "neutral",
};

export function feedStatusTone(status: FeedLifecycleStatus): FeedTone {
  return feedStatusToneMap[status] ?? "neutral";
}

export const FEED_STATUS_ORDER: FeedLifecycleStatus[] = ["Draft", "Published", "Withdrawn", "Archived"];

export function isPublished(status: FeedLifecycleStatus) {
  return status === "Published";
}

export function isDraft(status: FeedLifecycleStatus) {
  return status === "Draft";
}

// Feed items that are live to the audience. Draft/Withdrawn/Archived are not
// active in the feed.
export function isActiveFeedItem(status: FeedLifecycleStatus) {
  return status === "Published";
}

// Authoring/curation is only meaningful for Draft and Published items.
export function canEditFeedItem(status: FeedLifecycleStatus) {
  return status === "Draft" || status === "Published";
}

export function FeedStatusBadge({ status, className }: { status: FeedLifecycleStatus; className?: string }) {
  return <ToneBadge label={status} tone={feedStatusTone(status)} className={className} />;
}

// Priority is optional on a feed item. It shares the alert/incident severity
// vocabulary, so severity is never described two different ways.
export function FeedPriorityBadge({ priority, className }: { priority?: FeedPriority; className?: string }) {
  if (!priority) return null;
  return <ToneBadge label={priority} tone={incidentPriorityTone(priority)} className={className} />;
}

// Source type is a separate concept from lifecycle. It is a neutral descriptor.
export function sourceTypeLabel(type: FeedSourceType) {
  return type === "External" ? "External source" : "Internal";
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deterministic (UTC) date/time formatting so the prerendered markup and the
// hydrated client markup are byte-identical — no locale/timezone hydration drift.
export function formatFeedTimestamp(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS_SHORT[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
}
