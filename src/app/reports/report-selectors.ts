import type { AlertItem, IncidentItem } from "@/app/dashboard/mock-data";
import { alertAcknowledgementRate, alertOutstanding, formatAlertRate, formatAlertTimestamp } from "@/app/alerts/alert-status";
import { incidentTypeLabel } from "@/app/incidents/incident-status";
import type { ReportColumn, ReportDateRange, ReportFilterKey, ReportKind } from "./report-types";

export type ReportRecord = {
  cells: Record<string, string>;
  filters: Partial<Record<ReportFilterKey, string>>;
  /** Relative detail route for the source record, when one exists. */
  href?: string;
  /** Numeric fields reused by the summary, so summary and rows never diverge. */
  metrics?: { outstanding?: number; acknowledgementUnavailable?: boolean };
  /** Epoch ms used for the reporting-period filter; null when not derivable. */
  timestamp: number | null;
  /** Lower-cased text the search box matches against, never rendered. */
  searchText: string;
};

export type ReportFilters = Partial<Record<ReportFilterKey, string>>;

export type ReportStat = { key: string; label: string; value: number | string };

export type ReportSortState = { key: string; direction: "asc" | "desc" };

const MONTHS_SHORT: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY = 24 * 60 * 60 * 1000;

function searchText(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ").toLowerCase();
}

// Incident dates are stored as display strings ("06 Oct 2026 · 09:58"), so parse
// the date part back to a stable epoch (UTC) for period filtering. Mirrors the
// dashboard's parser so both surfaces agree on what "reported" means.
export function parseIncidentDate(value?: string): number | null {
  if (!value) return null;
  const datePart = value.split("·")[0]?.trim() ?? "";
  const match = datePart.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS_SHORT[match[2]];
  if (month === undefined) return null;
  return Date.UTC(Number(match[3]), month, Number(match[1]));
}

export function buildAlertRecords(alerts: AlertItem[]): ReportRecord[] {
  return alerts.map((alert) => {
    const outstanding = alertOutstanding(alert);
    const rate = alertAcknowledgementRate(alert);
    const ackState = !alert.acknowledgementRequired
      ? "not_required"
      : outstanding === null
        ? "unavailable"
        : outstanding === 0
        ? "complete"
        : "outstanding";
    const required = alert.acknowledgementRequired;
    const parsed = Date.parse(alert.updatedAt);

    return {
      cells: {
        reference: alert.id,
        title: alert.title,
        category: alert.category,
        priority: alert.priority,
        status: alert.status,
        audience: alert.audience,
        published: alert.publishedAt ? formatAlertTimestamp(alert.publishedAt) : "—",
        createdBy: alert.createdBy ?? "—",
        recipients: required ? String(alert.acknowledgementTargetCount ?? 0) : "—",
        acknowledged: required ? String(alert.acknowledgedCount ?? 0) : "—",
        outstanding: required ? (outstanding === null ? "Not available" : String(outstanding)) : "—",
        acknowledgement: required
          ? `${alert.acknowledgedCount ?? 0} / ${alert.acknowledgementTargetCount ?? 0} (${formatAlertRate(rate)})`
          : "Not required",
        escalation: alert.status === "Escalated" ? "Escalated" : "Not escalated",
        shareability: alert.shareability,
      },
      filters: {
        priority: alert.priority,
        status: alert.status,
        category: alert.category,
        audience: alert.audience,
        location: alert.location,
        ack: ackState,
      },
      href: `/alerts/${encodeURIComponent(alert.id)}`,
      metrics: required
        ? outstanding === null
          ? { acknowledgementUnavailable: true }
          : { outstanding }
        : { outstanding: 0 },
      timestamp: Number.isNaN(parsed) ? null : parsed,
      searchText: searchText([
        alert.id,
        alert.title,
        alert.summary,
        alert.category,
        alert.location,
        alert.audience,
        alert.createdBy,
        alert.notificationType,
      ]),
    };
  });
}

export function buildIncidentRecords(incidents: IncidentItem[]): ReportRecord[] {
  return incidents.map((incident) => {
    const assigned = [incident.assignment?.assignee, incident.assignment?.team].filter(Boolean).join(" · ");
    const reportType = incidentTypeLabel(incident.incidentType);
    return {
      cells: {
        reference: incident.id,
        title: incident.title,
        reportType,
        category: incident.category,
        priority: incident.priority,
        status: incident.status,
        reported: incident.reported,
        reporter: incident.reporter ?? "—",
        department: incident.department ?? "—",
        location: incident.location,
        assigned: assigned || "Unassigned",
        review: incident.reviewStatus,
      },
      filters: {
        reportType,
        category: incident.category,
        status: incident.status,
        priority: incident.priority,
        reviewStatus: incident.reviewStatus,
        department: incident.department,
        location: incident.location,
        assignee: assigned || "Unassigned",
      },
      href: `/incidents/${encodeURIComponent(incident.id)}`,
      timestamp: parseIncidentDate(incident.reported),
      searchText: searchText([
        incident.id,
        incident.title,
        incident.description,
        incident.category,
        incident.location,
        incident.reporter,
        incident.department,
        assigned,
        reportType,
      ]),
    };
  });
}

// Only explicit timeline/history events count as escalation records. A current
// "Escalated" lifecycle status alone does not prove that an event was recorded.
export function buildEscalationRecords(alerts: AlertItem[], incidents: IncidentItem[]): ReportRecord[] {
  const fromIncidents: ReportRecord[] = incidents
    .flatMap((incident) =>
      (incident.timeline ?? [])
        .filter((event) => /escalat/i.test(event.title))
        .map((event) => ({
          cells: {
            reference: incident.id,
            type: "Incident",
            subject: incident.title,
            target: "Not recorded",
            priority: incident.priority,
            reason: event.detail || "Not recorded",
            escalatedAt: event.time || "Not available",
            status: event.title,
          },
          filters: {
            escalationType: "Incident",
            escalationStatus: event.title,
            priority: incident.priority,
            targetGroup: "Not recorded",
          },
          href: `/incidents/${encodeURIComponent(incident.id)}`,
          timestamp: parseIncidentDate(event.time) ?? (Date.parse(event.time) || null),
          searchText: searchText([
            incident.id,
            incident.title,
            event.title,
            event.detail,
            "Incident",
            incident.priority,
          ]),
        })),
    );

  const fromAlerts: ReportRecord[] = alerts
    .flatMap((alert) =>
      (alert.history ?? [])
        .filter((event) => /escalat/i.test(event.title))
        .map((event) => {
          const target = event.escalation?.target ?? "Not recorded";
          const status = event.escalation?.status ?? event.title;
          return {
            cells: {
              reference: alert.id,
              type: "Alert",
              subject: alert.title,
              target,
              priority: alert.priority,
              reason: event.escalation?.reason || event.detail || "Not recorded",
              escalatedAt: event.time || "Not available",
              status,
            },
            filters: {
              escalationType: "Alert",
              escalationStatus: status,
              priority: alert.priority,
              targetGroup: target,
            },
            href: `/alerts/${encodeURIComponent(alert.id)}`,
            timestamp: parseIncidentDate(event.time) ?? (Date.parse(event.time) || null),
            searchText: searchText([
              alert.id,
              alert.title,
              event.title,
              event.detail,
              event.escalation?.reason,
              event.escalation?.target,
              event.escalation?.status,
              "Alert",
              alert.priority,
            ]),
          };
        }),
    );

  return [...fromIncidents, ...fromAlerts];
}

export type ResolvedRange = { from: number | null; to: number | null; error: string | null };

export function resolveDateRange(range: ReportDateRange, now: number | null): ResolvedRange {
  if (range.preset === "all") return { from: null, to: null, error: null };
  if (range.preset === "7d") return { from: now === null ? null : now - 7 * DAY, to: null, error: null };
  if (range.preset === "30d") return { from: now === null ? null : now - 30 * DAY, to: null, error: null };
  if (range.preset === "this_month") {
    if (now === null) return { from: null, to: null, error: null };
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
    return { from: start.getTime(), to: null, error: null };
  }

  const { start, end } = range;
  if (!start && !end) return { from: null, to: null, error: "Choose a start and end date for the custom range." };
  if (!start) return { from: null, to: null, error: "Choose a start date." };
  if (!end) return { from: null, to: null, error: "Choose an end date." };
  const from = Date.parse(`${start}T00:00:00.000Z`);
  const to = Date.parse(`${end}T23:59:59.999Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return { from: null, to: null, error: "Enter valid start and end dates." };
  if (from > to) return { from: null, to: null, error: "The start date must be on or before the end date." };
  return { from, to, error: null };
}

function formatIsoDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const month = MONTHS_LONG[Number(match[2]) - 1] ?? match[2];
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function dateRangeLabel(range: ReportDateRange): string {
  if (range.preset === "all") return "All time";
  if (range.preset === "7d") return "Last 7 days";
  if (range.preset === "30d") return "Last 30 days";
  if (range.preset === "this_month") return "This month";
  if (range.start && range.end) return `${formatIsoDate(range.start)} to ${formatIsoDate(range.end)}`;
  return "Custom range";
}

const FILTER_FIELDS: ReportFilterKey[] = [
  "priority",
  "status",
  "category",
  "audience",
  "location",
  "ack",
  "department",
  "assignee",
  "reportType",
  "reviewStatus",
  "escalationType",
  "escalationStatus",
  "targetGroup",
];

export function filterRecords(
  records: ReportRecord[],
  filters: ReportFilters,
  range: ResolvedRange,
  query = "",
): ReportRecord[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return records.filter((record) => {
    if (range.from !== null && (record.timestamp === null || record.timestamp < range.from)) return false;
    if (range.to !== null && (record.timestamp === null || record.timestamp > range.to)) return false;
    for (const key of FILTER_FIELDS) {
      const wanted = filters[key];
      if (!wanted || wanted === "all") continue;
      if (record.filters[key] !== wanted) return false;
    }
    if (tokens.length > 0 && !tokens.every((token) => record.searchText.includes(token))) return false;
    return true;
  });
}

export function derivedOptions(records: ReportRecord[], key: ReportFilterKey, allLabel: string) {
  const values = Array.from(
    new Set(records.map((record) => record.filters[key]).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));
  return [{ value: "all", label: allLabel }, ...values.map((value) => ({ value, label: value }))];
}

// Sorting is applied after filtering so page ranges and the exported workbook
// always follow the order the user sees in the table.
export function sortRecords(
  records: ReportRecord[],
  sort: ReportSortState | null,
  columns: ReportColumn[],
): ReportRecord[] {
  if (!sort) return records;
  const column = columns.find((item) => item.key === sort.key);
  if (!column) return records;
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...records].sort((a, b) => {
    if (column.sort === "date") {
      const aTime = a.timestamp ?? (sort.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const bTime = b.timestamp ?? (sort.direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      return (aTime - bTime) * direction;
    }
    return (a.cells[sort.key] ?? "").localeCompare(b.cells[sort.key] ?? "", undefined, { numeric: true }) * direction;
  });
}

// Summary metrics are derived from the exact filtered row set, so they always
// reconcile with the preview table.
export function buildSummary(kind: ReportKind, records: ReportRecord[]): ReportStat[] {
  const total = records.length;
  if (kind === "alert") {
    const stats: ReportStat[] = [{ key: "total", label: "Alerts returned", value: total }];
    for (const priority of ["Critical", "Advisory", "Informational"]) {
      stats.push({
        key: `priority-${priority}`,
        label: priority,
        value: records.filter((record) => record.filters.priority === priority).length,
      });
    }
    stats.push({
      key: "outstanding",
      label: "Outstanding acknowledgements",
      value: records.some((record) => record.metrics?.acknowledgementUnavailable)
        ? "Unavailable"
        : records.reduce((sum, record) => sum + (record.metrics?.outstanding ?? 0), 0),
    });
    return stats;
  }
  if (kind === "incident") {
    const stats: ReportStat[] = [{ key: "total", label: "Incidents returned", value: total }];
    const statuses = Array.from(
      new Set(records.map((record) => record.filters.status).filter((value): value is string => Boolean(value))),
    );
    for (const status of statuses) {
      stats.push({
        key: `status-${status}`,
        label: status,
        value: records.filter((record) => record.filters.status === status).length,
      });
    }
    return stats;
  }
  return [
    { key: "total", label: "Escalations returned", value: total },
    {
      key: "incident",
      label: "Incident escalations",
      value: records.filter((record) => record.filters.escalationType === "Incident").length,
    },
    {
      key: "alert",
      label: "Alert escalations",
      value: records.filter((record) => record.filters.escalationType === "Alert").length,
    },
  ];
}
