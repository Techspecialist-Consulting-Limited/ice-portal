import type { AlertItem, FeedItem, IncidentItem, IncidentType } from "@/app/dashboard/mock-data";
import { summarizeAlertAcknowledgement } from "../../alerts/alert-metrics";
import { isActiveAlert } from "../../alerts/alert-status";
import { isActiveIncident } from "../../incidents/incident-status";
import { parseIncidentReported } from "../../incidents/incident-reported";

export type ExecutiveReportKind = "summary" | "incidents" | "alerts" | "readiness";

export type ExecutiveReportRow = {
  section: string;
  measure: string;
  category: string;
  total: number | string;
  active: number | string;
  critical: number | string;
  completed: number | string;
  acknowledged: number | string;
  outstanding: number | string;
};

export type ExecutiveReportColumn = {
  key: keyof ExecutiveReportRow;
  label: string;
};

export type ExecutiveReportSources = {
  incidents: IncidentItem[];
  alerts: AlertItem[];
  feeds: FeedItem[];
};

export const EXECUTIVE_ADOPTION_SNAPSHOT = {
  current: { label: "October 2026", signedIn: 684, feedReaders: 512 },
  previous: { label: "September 2026", signedIn: 632, feedReaders: 468 },
} as const;

const INCIDENT_TYPE_OPTIONS: Array<{ value: IncidentType; label: string }> = [
  { value: "SOS", label: "SOS requests" },
  { value: "Emergency Report", label: "Emergency reports" },
  { value: "Incident Report", label: "Incident reports" },
];

const BASIC_COLUMNS: ExecutiveReportColumn[] = [
  { key: "measure", label: "Measure" },
  { key: "category", label: "Category" },
  { key: "total", label: "Total" },
];

export function getExecutiveReportColumns(kind: ExecutiveReportKind): ExecutiveReportColumn[] {
  if (kind === "incidents") {
    return [
      ...BASIC_COLUMNS,
      { key: "active", label: "Active" },
      { key: "critical", label: "Critical" },
      { key: "completed", label: "Resolved / closed" },
    ];
  }
  if (kind === "alerts") {
    return [
      ...BASIC_COLUMNS,
      { key: "active", label: "Live" },
      { key: "critical", label: "Critical" },
      { key: "completed", label: "Closed / withdrawn" },
      { key: "acknowledged", label: "Acknowledged" },
      { key: "outstanding", label: "Outstanding" },
    ];
  }
  return BASIC_COLUMNS;
}

export function executiveReportCell(row: ExecutiveReportRow, key: keyof ExecutiveReportRow): string {
  return String(row[key]);
}

export function filterExecutiveReportSources(
  sources: ExecutiveReportSources,
  now: number | null,
  periodDays: number | null,
): ExecutiveReportSources {
  if (now === null) {
    return periodDays === null
      ? sources
      : { incidents: [], alerts: [], feeds: [] };
  }
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000;
  const isInRange = (timestamp: number | null) =>
    timestamp !== null && timestamp <= now && (cutoff === null || timestamp >= cutoff);

  return {
    incidents: sources.incidents.filter((incident) => isInRange(parseIncidentReported(incident.reported))),
    alerts: sources.alerts.filter((alert) => {
      const timestamp = Date.parse(alert.publishedAt ?? alert.updatedAt);
      return isInRange(Number.isNaN(timestamp) ? null : timestamp);
    }),
    feeds: sources.feeds.filter((feed) => {
      if (feed.status !== "Published" || !feed.publishedAt) return false;
      const timestamp = Date.parse(feed.publishedAt);
      return isInRange(Number.isNaN(timestamp) ? null : timestamp);
    }),
  };
}

function row(
  section: string,
  measure: string,
  group: string,
  values: Partial<Omit<ExecutiveReportRow, "section" | "measure" | "category">> = {},
): ExecutiveReportRow {
  return {
    section,
    measure,
    category: group,
    total: values.total ?? 0,
    active: values.active ?? "—",
    critical: values.critical ?? "—",
    completed: values.completed ?? "—",
    acknowledged: values.acknowledged ?? "—",
    outstanding: values.outstanding ?? "—",
  };
}

function groupCounts<T>(
  items: T[],
  getGroup: (item: T) => string,
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getGroup(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function incidentRows(incidents: IncidentItem[]): ExecutiveReportRow[] {
  const dimensions = [
    { name: "Status", value: (incident: IncidentItem) => incident.status },
    { name: "Priority", value: (incident: IncidentItem) => incident.priority },
    { name: "Category", value: (incident: IncidentItem) => incident.category.trim() || "Unspecified" },
    { name: "Report type", value: (incident: IncidentItem) => incident.incidentType ?? "Incident Report" },
  ];

  return dimensions.flatMap(({ name, value }) =>
    groupCounts(incidents, value).map(([group, items]) => row(
      "Incidents",
      name,
      group,
      {
        total: items.length,
        active: items.filter((incident) => isActiveIncident(incident.status)).length,
        critical: items.filter((incident) => incident.priority === "Critical").length,
        completed: items.filter((incident) => incident.status === "Resolved" || incident.status === "Closed").length,
      },
    )),
  );
}

function alertRows(alerts: AlertItem[]): ExecutiveReportRow[] {
  const dimensions = [
    { name: "Status", value: (alert: AlertItem) => alert.status },
    { name: "Priority", value: (alert: AlertItem) => alert.priority },
    { name: "Category", value: (alert: AlertItem) => alert.category.trim() || "Unspecified" },
    { name: "Acknowledgement", value: (alert: AlertItem) => alert.acknowledgementRequired ? "Required" : "Not required" },
  ];

  return dimensions.flatMap(({ name, value }) =>
    groupCounts(alerts, value).map(([group, items]) => {
      const acknowledgement = summarizeAlertAcknowledgement(items);
      const requiresAcknowledgement = items.some((alert) => alert.acknowledgementRequired);
      return row(
        "Alerts",
        name,
        group,
        {
          total: items.length,
          active: items.filter((alert) => isActiveAlert(alert.status)).length,
          critical: items.filter((alert) => alert.priority === "Critical").length,
          completed: items.filter((alert) => alert.status === "Closed" || alert.status === "Withdrawn").length,
          acknowledged: !requiresAcknowledgement
            ? "Not required"
            : acknowledgement.available
              ? acknowledgement.acknowledged
              : "Not available",
          outstanding: !requiresAcknowledgement
            ? "Not required"
            : acknowledgement.available
              ? acknowledgement.outstanding
              : "Not available",
        },
      );
    }),
  );
}

function readinessRows(sources: ExecutiveReportSources): ExecutiveReportRow[] {
  const current = EXECUTIVE_ADOPTION_SNAPSHOT.current;
  const previous = EXECUTIVE_ADOPTION_SNAPSHOT.previous;
  const acknowledgement = summarizeAlertAcknowledgement(sources.alerts);
  const adoptionRows = [
    row("Staff adoption", "Staff signed in", current.label, { total: current.signedIn }),
    row("Staff adoption", "Security Feed readers", current.label, { total: current.feedReaders }),
    row("Staff adoption", "Feed readership rate", current.label, {
      total: `${Math.round((current.feedReaders / current.signedIn) * 100)}%`,
    }),
    row("Staff adoption", "Staff signed in", previous.label, { total: previous.signedIn }),
    row("Staff adoption", "Security Feed readers", previous.label, { total: previous.feedReaders }),
    row("Staff adoption", "Feed readership rate", previous.label, {
      total: `${Math.round((previous.feedReaders / previous.signedIn) * 100)}%`,
    }),
    row("Acknowledgement", "Acknowledgement rate", "Selected period", {
      total: acknowledgement.available
        ? `${Math.round(acknowledgement.completionRate ?? 0)}%`
        : "Not available",
    }),
    row("Activity", "Incidents reported", "Selected period", { total: sources.incidents.length }),
    row("Activity", "Alerts issued", "Selected period", { total: sources.alerts.length }),
    row("Activity", "Security Feed items published", "Selected period", { total: sources.feeds.length }),
  ];
  const typeRows = INCIDENT_TYPE_OPTIONS.map(({ value, label }) =>
    row("Reports received", "Incident report type", label, {
      total: sources.incidents.filter((incident) => (incident.incidentType ?? "Incident Report") === value).length,
    }),
  );
  const acknowledgementRows = [
    row("Acknowledgement", "Acknowledgements received", "Alerts requiring acknowledgement", {
      total: acknowledgement.available ? acknowledgement.acknowledged : "Not available",
    }),
    row("Acknowledgement", "Acknowledgements outstanding", "Alerts requiring acknowledgement", {
      total: acknowledgement.available ? acknowledgement.outstanding : "Not available",
    }),
  ];
  return [...adoptionRows, ...typeRows, ...acknowledgementRows];
}

export function buildExecutiveReportRows(
  kind: ExecutiveReportKind,
  sources: ExecutiveReportSources,
): ExecutiveReportRow[] {
  if (kind === "incidents") return incidentRows(sources.incidents);
  if (kind === "alerts") return alertRows(sources.alerts);
  if (kind === "readiness") return readinessRows(sources);

  const acknowledgement = summarizeAlertAcknowledgement(sources.alerts);
  return [
    row("Executive summary", "Incidents reported", "Selected period", { total: sources.incidents.length }),
    row("Executive summary", "Active incidents", "Selected period", {
      total: sources.incidents.filter((incident) => isActiveIncident(incident.status)).length,
    }),
    row("Executive summary", "Critical incidents", "Selected period", {
      total: sources.incidents.filter((incident) => incident.priority === "Critical").length,
    }),
    row("Executive summary", "Resolved / closed incidents", "Selected period", {
      total: sources.incidents.filter((incident) => incident.status === "Resolved" || incident.status === "Closed").length,
    }),
    row("Executive summary", "Alerts issued", "Selected period", { total: sources.alerts.length }),
    row("Executive summary", "Live alerts", "Selected period", {
      total: sources.alerts.filter((alert) => isActiveAlert(alert.status)).length,
    }),
    row("Executive summary", "Acknowledgements received", "Required alerts", {
      total: acknowledgement.available ? acknowledgement.acknowledged : "Not available",
    }),
    row("Executive summary", "Acknowledgements outstanding", "Required alerts", {
      total: acknowledgement.available ? acknowledgement.outstanding : "Not available",
    }),
    row("Executive summary", "Staff signed in", EXECUTIVE_ADOPTION_SNAPSHOT.current.label, {
      total: EXECUTIVE_ADOPTION_SNAPSHOT.current.signedIn,
    }),
    row("Executive summary", "Security Feed readers", EXECUTIVE_ADOPTION_SNAPSHOT.current.label, {
      total: EXECUTIVE_ADOPTION_SNAPSHOT.current.feedReaders,
    }),
    row("Executive summary", "Feed readership rate", EXECUTIVE_ADOPTION_SNAPSHOT.current.label, {
      total: `${Math.round((EXECUTIVE_ADOPTION_SNAPSHOT.current.feedReaders / EXECUTIVE_ADOPTION_SNAPSHOT.current.signedIn) * 100)}%`,
    }),
    row("Executive summary", "Security Feed items published", "Selected period", { total: sources.feeds.length }),
    ...INCIDENT_TYPE_OPTIONS.map(({ value, label }) =>
      row("Executive summary", "Incident report type", label, {
        total: sources.incidents.filter((incident) => (incident.incidentType ?? "Incident Report") === value).length,
      }),
    ),
  ];
}

export function executiveReportCsvRows(
  rows: ExecutiveReportRow[],
  columns: ExecutiveReportColumn[],
): Array<Record<string, string>> {
  return rows.map((item) =>
    Object.fromEntries(columns.map(({ key }) => [key, executiveReportCell(item, key)])),
  );
}
