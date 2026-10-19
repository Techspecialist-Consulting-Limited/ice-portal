import type { AlertItem } from "@/app/dashboard/mock-data";
import { isActiveAlert, isAwaitingAcknowledgement } from "./alert-status";

// Single source of truth for alert summary figures. The dashboard KPI cards and
// the Alerts & Advisories summary cards both read these, so a count shown on one
// screen always matches the filtered list it links to on the other.

export function countActiveAlerts(alerts: AlertItem[]): number {
  return alerts.filter((alert) => isActiveAlert(alert.status)).length;
}

// The "Critical" card counts active critical alerts, so its navigation filter
// must apply both the active scope and the Critical priority.
export function countActiveCriticalAlerts(alerts: AlertItem[]): number {
  return alerts.filter((alert) => isActiveAlert(alert.status) && alert.priority === "Critical").length;
}

export function countAlertsAwaitingAcknowledgement(alerts: AlertItem[]): number {
  return alerts.filter(isAwaitingAcknowledgement).length;
}

export function countEscalatedAlerts(alerts: AlertItem[]): number {
  return alerts.filter((alert) => alert.status === "Escalated").length;
}

export type AlertAcknowledgementSummary = {
  /** False when an active acknowledgement-required alert is missing a count. */
  available: boolean;
  /** Number of acknowledgement-required alerts in the set. */
  requiredCount: number;
  targeted: number;
  acknowledged: number;
  outstanding: number;
  /** Percentage 0–100, or null when it cannot be computed. */
  completionRate: number | null;
};

// Aggregate acknowledgement across acknowledgement-required alerts. If any such
// alert is missing its target or acknowledged count the totals would understate
// reality, so the summary reports itself unavailable rather than showing a false
// denominator.
export function summarizeAlertAcknowledgement(alerts: AlertItem[]): AlertAcknowledgementSummary {
  const required = alerts.filter((alert) => alert.acknowledgementRequired);
  const incomplete = required.some(
    (alert) => alert.acknowledgementTargetCount === undefined || alert.acknowledgedCount === undefined,
  );
  if (incomplete) {
    return { available: false, requiredCount: required.length, targeted: 0, acknowledged: 0, outstanding: 0, completionRate: null };
  }
  const targeted = required.reduce((sum, alert) => sum + (alert.acknowledgementTargetCount ?? 0), 0);
  const acknowledged = required.reduce((sum, alert) => sum + (alert.acknowledgedCount ?? 0), 0);
  const outstanding = Math.max(0, targeted - acknowledged);
  const completionRate = targeted > 0 ? (acknowledged / targeted) * 100 : null;
  return { available: true, requiredCount: required.length, targeted, acknowledged, outstanding, completionRate };
}
