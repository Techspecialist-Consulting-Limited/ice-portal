import type { AlertItem, AlertLifecycleStatus } from "@/app/dashboard/mock-data";
import { alertOutstanding, isActiveAlert } from "../../alerts/alert-status";

export type AlertAnalyticsFilters = {
  period: string;
  category: string;
  priority: string;
  status: string;
  acknowledgement: string;
};

export type AlertAnalyticsDimension = "status" | "priority" | "category" | "acknowledgement";

export type AlertDistributionItem = {
  value: string;
  count: number;
  active: number;
  critical: number;
  acknowledged: number | null;
  outstanding: number | null;
};

export const ALERT_PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

export const ALERT_ANALYTICS_DIMENSIONS: Array<{
  value: AlertAnalyticsDimension;
  label: string;
}> = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "category", label: "Category" },
  { value: "acknowledgement", label: "Acknowledgement" },
];

export function getAlertAnalyticsDimensionLabel(dimension: AlertAnalyticsDimension): string {
  return ALERT_ANALYTICS_DIMENSIONS.find((item) => item.value === dimension)?.label ?? dimension;
}

export function getAlertValue(alert: AlertItem, dimension: AlertAnalyticsDimension): string {
  switch (dimension) {
    case "status":
      return alert.status;
    case "priority":
      return alert.priority;
    case "category":
      return alert.category.trim() || "Unspecified";
    case "acknowledgement":
      return alert.acknowledgementRequired ? "Required" : "Not required";
  }
}

export function filterAlerts(
  alerts: AlertItem[],
  filters: AlertAnalyticsFilters,
  now: number | null,
): AlertItem[] {
  const periodDays = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : null;
  const cutoff = periodDays === null || now === null ? null : now - periodDays * 24 * 60 * 60 * 1000;

  return alerts.filter((alert) => {
    if (filters.category !== "all" && getAlertValue(alert, "category") !== filters.category) return false;
    if (filters.priority !== "all" && alert.priority !== filters.priority) return false;
    if (filters.status !== "all" && alert.status !== filters.status) return false;
    if (filters.acknowledgement === "required" && !alert.acknowledgementRequired) return false;
    if (filters.acknowledgement === "not-required" && alert.acknowledgementRequired) return false;
    if (cutoff !== null) {
      const updatedAt = alert.updatedAt ? Date.parse(alert.updatedAt) : Number.NaN;
      if (!Number.isFinite(updatedAt) || updatedAt < cutoff || (now !== null && updatedAt > now)) return false;
    }
    return true;
  });
}

export function summarizeAlerts(alerts: AlertItem[]) {
  const requiredAlerts = alerts.filter((alert) => alert.acknowledgementRequired);
  const acknowledgementAvailable = requiredAlerts.every(
    (alert) => alert.acknowledgementTargetCount !== undefined && alert.acknowledgedCount !== undefined,
  );

  return {
    total: alerts.length,
    active: alerts.filter((alert) => isActiveAlert(alert.status)).length,
    critical: alerts.filter((alert) => alert.priority === "Critical").length,
    acknowledged: acknowledgementAvailable
      ? requiredAlerts.reduce((total, alert) => total + (alert.acknowledgedCount ?? 0), 0)
      : null,
    outstanding: acknowledgementAvailable
      ? requiredAlerts.reduce((total, alert) => total + (alertOutstanding(alert) ?? 0), 0)
      : null,
  };
}

export function getAlertDistribution(
  alerts: AlertItem[],
  dimension: AlertAnalyticsDimension,
): AlertDistributionItem[] {
  const groups = new Map<string, AlertItem[]>();
  alerts.forEach((alert) => {
    const value = getAlertValue(alert, dimension);
    const group = groups.get(value) ?? [];
    group.push(alert);
    groups.set(value, group);
  });

  return [...groups.entries()].map(([value, group]) => {
    const requiredAlerts = group.filter((alert) => alert.acknowledgementRequired);
    const acknowledgementAvailable = requiredAlerts.every(
      (alert) => alert.acknowledgementTargetCount !== undefined && alert.acknowledgedCount !== undefined,
    );

    return {
      value,
      count: group.length,
      active: group.filter((alert) => isActiveAlert(alert.status)).length,
      critical: group.filter((alert) => alert.priority === "Critical").length,
      acknowledged: acknowledgementAvailable
        ? requiredAlerts.reduce((total, alert) => total + (alert.acknowledgedCount ?? 0), 0)
        : null,
      outstanding: acknowledgementAvailable
        ? requiredAlerts.reduce((total, alert) => total + (alertOutstanding(alert) ?? 0), 0)
        : null,
    };
  }).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export const ALERT_PRIORITY_OPTIONS = ["Critical", "Advisory", "Informational"] as const;
export const ALERT_STATUS_OPTIONS: AlertLifecycleStatus[] = [
  "Draft",
  "Published",
  "Acknowledgement pending",
  "Escalated",
  "Updated",
  "Withdrawn",
  "Closed",
];
