import type { IncidentItem, IncidentStatus, IncidentType } from "@/app/dashboard/mock-data";
import { Siren, TriangleAlert, ClipboardList, type LucideIcon } from "lucide-react";

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

// Report type badge configuration: unique icon, background color, and text/icon color
// for each canonical report type, as specified in the approved visual reference.
const reportTypeConfig: Record<IncidentType, { icon: LucideIcon; bg: string; text: string }> = {
  SOS: {
    icon: Siren,
    bg: "#C62828",
    text: "#FFFFFF",
  },
  "Emergency Report": {
    icon: TriangleAlert,
    bg: "#FFF2D6",
    text: "#A15C00",
  },
  "Incident Report": {
    icon: ClipboardList,
    bg: "#FFE5E5",
    text: "#C62828",
  },
};

export const UNCLASSIFIED_INCIDENT_TYPE = "Needs classification" as const;

export function isIncidentType(value: unknown): value is IncidentType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(reportTypeConfig, value);
}

export function incidentTypeLabel(value: unknown): IncidentType | typeof UNCLASSIFIED_INCIDENT_TYPE {
  return isIncidentType(value) ? value : UNCLASSIFIED_INCIDENT_TYPE;
}

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

export function IncidentTypeBadge({
  incidentType,
  className,
}: {
  incidentType?: IncidentType | string | null;
  className?: string;
}) {
  if (!isIncidentType(incidentType)) {
    return <ToneBadge label={UNCLASSIFIED_INCIDENT_TYPE} tone="neutral" className={className} />;
  }
  const config = reportTypeConfig[incidentType];
  const Icon = config.icon;
  // SOS is the only report type that carries an urgency indicator, rendered last
  // so the order is always icon -> label -> dot.
  const isSos = incidentType === "SOS";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        isSos && "whitespace-nowrap pr-3",
        className
      )}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", isSos && "shrink-0")} strokeWidth={2} />
      <span>{incidentType}</span>
      {isSos && <span aria-hidden="true" className="ice-sos-dot h-2 w-2 shrink-0 rounded-full bg-white" />}
    </span>
  );
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
