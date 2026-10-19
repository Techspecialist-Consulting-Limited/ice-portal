import type { AlertEscalationEventDetails, AlertItem, AlertPriority } from "@/app/dashboard/mock-data";
import type { IncidentTone } from "../incidents/incident-status";

export type EscalationStatus =
  | "Not Required"
  | "Waiting"
  | "Eligible"
  | "Triggered"
  | "Delivered"
  | "Acknowledged"
  | "Completed"
  | "Failed";

export type EscalationChannel = "SMS" | "Email" | "Push notification" | "Voice call" | "Not recorded";

export type AlertEscalation = {
  id: string;
  alertId: string;
  alertTitle: string;
  priority: AlertPriority;
  level: number | null;
  levelLabel: string;
  reason: string;
  target: string;
  channel: EscalationChannel;
  status: EscalationStatus;
  /** ISO timestamp; absent for records that have not been triggered yet. */
  triggeredAt?: string;
  failureReason?: string;
};

// Ordered lifecycle stages for filters, matching the brief's escalation states.
export const ESCALATION_STATUS_ORDER: EscalationStatus[] = [
  "Not Required",
  "Waiting",
  "Eligible",
  "Triggered",
  "Delivered",
  "Acknowledged",
  "Completed",
  "Failed",
];

// Summary/filter groups. Every record falls into exactly one bucket, so the
// summary cards always reconcile with the filtered rows.
const DELIVERED_STATUSES: EscalationStatus[] = ["Delivered", "Acknowledged", "Completed"];

export type EscalationGroup = "all" | "in_progress" | "delivered" | "failed";

export function escalationGroup(status: EscalationStatus): Exclude<EscalationGroup, "all"> {
  if (status === "Failed") return "failed";
  if (DELIVERED_STATUSES.includes(status)) return "delivered";
  return "in_progress";
}

export function escalationStatusTone(status: EscalationStatus): IncidentTone {
  switch (status) {
    case "Failed":
      return "danger";
    case "Triggered":
      return "warning";
    case "Eligible":
    case "Waiting":
      return "info";
    case "Delivered":
      return "primary";
    case "Acknowledged":
    case "Completed":
      return "success";
    default:
      return "neutral";
  }
}

function historyTimestamp(value: string): string | undefined {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*[·•]\s*(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[2]);
  if (month < 0) return undefined;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]))).toISOString();
}

function historyStatus(title: string): EscalationStatus {
  const normalized = title.toLowerCase();
  if (normalized.includes("fail")) return "Failed";
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("acknowledg")) return "Acknowledged";
  if (normalized.includes("deliver")) return "Delivered";
  return "Triggered";
}

const KNOWN_CHANNELS: EscalationChannel[] = ["SMS", "Email", "Push notification", "Voice call"];

function resolveChannel(value: string | undefined): EscalationChannel {
  return value && (KNOWN_CHANNELS as string[]).includes(value) ? (value as EscalationChannel) : "Not recorded";
}

// A recorded outcome is trusted only when it is one of the known states; a
// legacy event (no structured payload) falls back to reading its title.
function resolveStatus(details: AlertEscalationEventDetails | undefined, title: string): EscalationStatus {
  const recorded = details?.status;
  if (recorded && (ESCALATION_STATUS_ORDER as string[]).includes(recorded)) {
    return recorded as EscalationStatus;
  }
  return historyStatus(title);
}

// True when an alert has at least one escalation event recorded in its history.
// This is the only condition that produces an escalation record — the lifecycle
// status alone does not.
export function hasRecordedEscalation(alert: AlertItem): boolean {
  return (alert.history ?? []).some((event) => /escalat/i.test(event.title));
}

export function buildAlertEscalations(alerts: AlertItem[]): AlertEscalation[] {
  return alerts.flatMap((alert) =>
    (alert.history ?? [])
      .filter((event) => /escalat/i.test(event.title))
      .map((event, index) => {
        const details = event.escalation;
        const level = details?.level ?? null;
        return {
          id: `ESC-${alert.id}-${index + 1}`,
          alertId: alert.id,
          alertTitle: alert.title,
          priority: alert.priority,
          level,
          levelLabel: details?.levelLabel ?? (level !== null ? `Level ${level}` : "Not recorded"),
          reason: details?.reason || event.detail || "Not recorded",
          target: details?.target ?? "Not recorded",
          channel: resolveChannel(details?.channel),
          status: resolveStatus(details, event.title),
          triggeredAt: historyTimestamp(event.time),
        } satisfies AlertEscalation;
      }),
  );
}

export type EscalationTotals = {
  total: number;
  inProgress: number;
  delivered: number;
  failed: number;
};

export function escalationTotals(records: AlertEscalation[]): EscalationTotals {
  let inProgress = 0;
  let delivered = 0;
  let failed = 0;
  for (const record of records) {
    const group = escalationGroup(record.status);
    if (group === "failed") failed += 1;
    else if (group === "delivered") delivered += 1;
    else inProgress += 1;
  }
  return { total: records.length, inProgress, delivered, failed };
}

// Most-recently-triggered first; untriggered (pending) records sort last.
export function escalationOperationalRank(record: AlertEscalation): number {
  return record.triggeredAt ? 0 : 1;
}
