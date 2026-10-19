import type { AlertItem, AlertLifecycleStatus, AlertPriority } from "@/app/dashboard/mock-data";
import { ToneBadge, type IncidentTone } from "../incidents/incident-status";

export type AlertTone = IncidentTone;
export type { AlertPriority };

// Single source of truth for alert lifecycle semantics. Badges, filters and the
// dashboard all derive from here so an alert state is never described two ways.
const alertStatusToneMap: Record<AlertLifecycleStatus, AlertTone> = {
  Draft: "neutral",
  Published: "success",
  "Acknowledgement pending": "warning",
  Escalated: "danger",
  Updated: "info",
  Withdrawn: "neutral",
  Closed: "neutral",
};

export function alertStatusTone(status: AlertLifecycleStatus): AlertTone {
  return alertStatusToneMap[status] ?? "neutral";
}

export const ALERT_STATUS_ORDER: AlertLifecycleStatus[] = [
  "Draft",
  "Published",
  "Acknowledgement pending",
  "Escalated",
  "Updated",
  "Withdrawn",
  "Closed",
];

// Statuses that mean the alert is live to its audience. Draft is not active;
// Withdrawn and Closed are terminal.
const ACTIVE_ALERT_STATUSES: AlertLifecycleStatus[] = [
  "Published",
  "Acknowledgement pending",
  "Escalated",
  "Updated",
];

export function isActiveAlert(status: AlertLifecycleStatus) {
  return ACTIVE_ALERT_STATUSES.includes(status);
}

// Terminal alerts (Withdrawn, Closed) are read-only history: they cannot be
// reopened or edited. Every other state is still under the administrator's
// control, so the Edit action is offered against the same rule everywhere.
const EDITABLE_ALERT_STATUSES: AlertLifecycleStatus[] = [
  "Draft",
  "Published",
  "Acknowledgement pending",
  "Escalated",
  "Updated",
];

export function canEditAlert(status: AlertLifecycleStatus) {
  return EDITABLE_ALERT_STATUSES.includes(status);
}

// Outstanding acknowledgements, only meaningful when acknowledgement is required.
export function alertOutstanding(alert: AlertItem): number | null {
  if (!alert.acknowledgementRequired) return 0;
  const target = alert.acknowledgementTargetCount;
  const acknowledged = alert.acknowledgedCount;
  if (target === undefined || acknowledged === undefined) return null;
  return Math.max(0, target - acknowledged);
}

// An active alert that is still waiting on recipients to acknowledge.
export function isAwaitingAcknowledgement(alert: AlertItem) {
  const outstanding = alertOutstanding(alert);
  return isActiveAlert(alert.status) && alert.acknowledgementRequired && outstanding !== null && outstanding > 0;
}

export function alertAcknowledgementRate(alert: AlertItem): number | null {
  if (!alert.acknowledgementRequired) return null;
  const target = alert.acknowledgementTargetCount;
  const acknowledged = alert.acknowledgedCount;
  if (target === undefined || target <= 0) return null;
  if (acknowledged === undefined) return null;
  return (acknowledged / target) * 100;
}

export function AlertStatusBadge({ status, className }: { status: AlertLifecycleStatus; className?: string }) {
  return <ToneBadge label={status} tone={alertStatusTone(status)} className={className} />;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deterministic (UTC) date/time formatting so the prerendered markup and the
// hydrated client markup are byte-identical — no locale/timezone hydration drift.
export function formatAlertTimestamp(value?: string): string {
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

export function formatAlertRate(rate: number | null): string {
  if (rate === null) return "Not available";
  return `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
}
