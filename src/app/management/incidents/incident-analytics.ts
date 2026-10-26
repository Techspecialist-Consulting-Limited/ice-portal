import type { IncidentItem, IncidentStatus } from "@/app/dashboard/mock-data";
import { INCIDENT_STATUS_ORDER, isActiveIncident } from "../../incidents/incident-status";
import { parseIncidentReported } from "../../incidents/incident-reported";

export type IncidentAnalyticsFilters = {
  period: string;
  category: string;
  priority: string;
  incidentType: string;
};

export type IncidentAnalyticsDimension = "status" | "priority" | "category" | "incidentType";

export type IncidentDistributionItem = {
  value: string;
  count: number;
  active: number;
  critical: number;
  resolved: number;
};

export const INCIDENT_PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

export const INCIDENT_ANALYTICS_DIMENSIONS: Array<{
  value: IncidentAnalyticsDimension;
  label: string;
}> = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "category", label: "Category" },
  { value: "incidentType", label: "Incident type" },
];

export function getIncidentAnalyticsDimensionLabel(dimension: IncidentAnalyticsDimension): string {
  return INCIDENT_ANALYTICS_DIMENSIONS.find((item) => item.value === dimension)?.label ?? dimension;
}

export function getIncidentValue(incident: IncidentItem, dimension: IncidentAnalyticsDimension): string {
  switch (dimension) {
    case "status":
      return incident.status;
    case "priority":
      return incident.priority;
    case "category":
      return incident.category.trim() || "Unspecified";
    case "incidentType":
      return incident.incidentType ?? "Incident Report";
  }
}

export function filterIncidents(
  incidents: IncidentItem[],
  filters: IncidentAnalyticsFilters,
  now: number | null,
): IncidentItem[] {
  const periodDays = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : null;
  const cutoff = periodDays === null || now === null ? null : now - periodDays * 24 * 60 * 60 * 1000;

  return incidents.filter((incident) => {
    if (filters.category !== "all" && getIncidentValue(incident, "category") !== filters.category) return false;
    if (filters.priority !== "all" && incident.priority !== filters.priority) return false;
    if (filters.incidentType !== "all" && getIncidentValue(incident, "incidentType") !== filters.incidentType) return false;
    if (cutoff !== null) {
      const reportedAt = parseIncidentReported(incident.reported);
      if (reportedAt === null || reportedAt < cutoff || (now !== null && reportedAt > now)) return false;
    }
    return true;
  });
}

export function getIncidentDistribution(
  incidents: IncidentItem[],
  dimension: IncidentAnalyticsDimension,
): IncidentDistributionItem[] {
  const values = new Map<string, IncidentDistributionItem>();

  incidents.forEach((incident) => {
    const value = getIncidentValue(incident, dimension);
    const current = values.get(value) ?? { value, count: 0, active: 0, critical: 0, resolved: 0 };
    current.count += 1;
    if (isActiveIncident(incident.status)) current.active += 1;
    if (incident.priority === "Critical") current.critical += 1;
    if (incident.status === "Resolved" || incident.status === "Closed") current.resolved += 1;
    values.set(value, current);
  });

  return [...values.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function summarizeIncidents(incidents: IncidentItem[]) {
  return {
    total: incidents.length,
    active: incidents.filter((incident) => isActiveIncident(incident.status)).length,
    critical: incidents.filter((incident) => incident.priority === "Critical").length,
    resolved: incidents.filter((incident) => incident.status === "Resolved" || incident.status === "Closed").length,
  };
}

export function getStatusCounts(incidents: IncidentItem[]) {
  return INCIDENT_STATUS_ORDER.map((status: IncidentStatus) => ({
    value: status,
    count: incidents.filter((incident) => incident.status === status).length,
  }));
}
