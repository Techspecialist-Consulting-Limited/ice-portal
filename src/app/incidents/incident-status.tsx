import type { IncidentItem, IncidentStatus } from "@/app/dashboard/mock-data";

export type IncidentTone = "danger" | "warning" | "info" | "success" | "neutral" | "primary";
export type IncidentPriority = IncidentItem["priority"];

// Single source of truth for incident status/priority semantics. Every dashboard
// and incident-queue/detail surface must derive its badge tone and bar colour from
// here so the same state is never styled two different ways.
const statusToneMap: Record<IncidentStatus, IncidentTone> = {
  Submitted: "neutral",
  "Under review": "primary",
  Verified: "success",
  Rejected: "danger",
  Escalated: "danger",
  Broadcast: "info",
  Resolved: "success",
  Closed: "neutral",
};

const priorityToneMap: Record<IncidentPriority, IncidentTone> = {
  Critical: "danger",
  Advisory: "warning",
  Informational: "info",
};

export function incidentStatusTone(status: IncidentStatus): IncidentTone {
  return statusToneMap[status] ?? "neutral";
}

export function incidentPriorityTone(priority: IncidentPriority): IncidentTone {
  return priorityToneMap[priority] ?? "info";
}

const toneClassMap: Record<IncidentTone, string> = {
  danger: "bg-[#fee2e2] text-[#991b1b]",
  warning: "bg-[#fff4d6] text-[#9a6700]",
  info: "bg-[#eaf3ff] text-[#1d4ed8]",
  success: "bg-[#eaf7ee] text-[#166534]",
  neutral: "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ToneBadge({ label, tone, className }: { label: string; tone: IncidentTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", toneClassMap[tone], className)}>
      {label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return <ToneBadge label={status} tone={incidentStatusTone(status)} className={className} />;
}

export function PriorityBadge({ priority, className }: { priority: IncidentPriority; className?: string }) {
  return <ToneBadge label={priority} tone={incidentPriorityTone(priority)} className={className} />;
}

// The workflow stages shown in the dashboard "Incident status" panel, in order.
// "Rejected" is a terminal outcome, not an active workflow stage, so it is excluded
// from active totals — matching the queue when "Rejected" is not selected.
export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  "Submitted",
  "Under review",
  "Verified",
  "Rejected",
  "Escalated",
  "Broadcast",
  "Resolved",
  "Closed",
];

const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  "Submitted",
  "Under review",
  "Verified",
  "Escalated",
  "Broadcast",
];

export function isActiveIncident(status: IncidentStatus) {
  return ACTIVE_INCIDENT_STATUSES.includes(status);
}

// "Review required" = reported but not yet moved into review, based on the real
// workflow state (submitted records awaiting a first decision).
export function isReviewRequired(status: IncidentStatus) {
  return status === "Submitted";
}

// Horizontal track fill colour for the "Incident status" panel. Derived from the
// same tone map the badges use, so a status is never styled two different ways —
// e.g. "Under review" shows the same primary green bar as it does a badge.
const toneBarColorMap: Record<IncidentTone, string> = {
  danger: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
  success: "#16a34a",
  neutral: "#94a3b8",
  primary: "#087443",
};

export function incidentStatusBarColor(status: IncidentStatus): string {
  return toneBarColorMap[incidentStatusTone(status)];
}
