/**
 * Shared parser for incident `reportedAt` fixture timestamps.
 *
 * Legacy incident timestamps are formatted like "06 Oct 2026 · 15:35" (UTC).
 * New records carry a canonical ISO UTC timestamp in `reportedAt`.
 * Both the Incident Queue (filtering/sorting) and the dashboard KPI
 * selectors must interpret these values identically so scoped incident
 * counts cannot diverge between the two pages.
 */

const MONTHS = new Map<string, number>(
  [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].map((month, index) => [month.toLowerCase(), index]),
);

const REPORTED_AT_PATTERN = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*[·•]\s*(\d{2}):(\d{2})$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const ORGANISATION_TIME_ZONE = "Africa/Lagos";

const dayKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ORGANISATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar-day key (YYYY-MM-DD) of an instant in the organisation's Africa/Lagos timezone. */
export function organisationDayKey(timestamp: number): string {
  const parts = dayKeyFormatter.formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Returns the UTC timestamp (ms) of a reported-at string, or `null` if invalid. */
export function parseIncidentReported(reportedAt: string): number | null {
  const rawTimestamp = reportedAt.trim();
  if (ISO_TIMESTAMP_PATTERN.test(rawTimestamp)) {
    const timestamp = Date.parse(rawTimestamp);
    if (Number.isNaN(timestamp)) return null;
    const normalized = rawTimestamp.includes(".") ? rawTimestamp : rawTimestamp.replace(/Z$/, ".000Z");
    return new Date(timestamp).toISOString() === normalized ? timestamp : null;
  }

  const match = REPORTED_AT_PATTERN.exec(rawTimestamp);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = MONTHS.get(match[2].toLowerCase());
  const year = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  if (month === undefined) {
    return null;
  }

  const timestamp = Date.UTC(year, month, day, hours, minutes);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hours ||
    parsed.getUTCMinutes() !== minutes
  ) {
    return null;
  }

  return timestamp;
}

export function getIncidentReportedTimestamp(incident: { reported: string; reportedAt?: string }): number | null {
  return parseIncidentReported(incident.reportedAt ?? incident.reported);
}

export function formatIncidentTimestamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORGANISATION_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORGANISATION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export function formatIncidentReported(incident: { reported: string; reportedAt?: string }): string {
  const timestamp = incident.reportedAt ? getIncidentReportedTimestamp(incident) : null;
  if (timestamp === null) return incident.reported;

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: ORGANISATION_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORGANISATION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));

  return `${date} · ${time}`;
}
