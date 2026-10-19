/**
 * Shared parser for incident `reportedAt` fixture timestamps.
 *
 * Incident timestamps are formatted like "06 Oct 2026 · 15:35" (UTC).
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

/** Returns the UTC timestamp (ms) of a reported-at string, or `null` if invalid. */
export function parseIncidentReported(reportedAt: string): number | null {
  const match = REPORTED_AT_PATTERN.exec(reportedAt.trim());
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

  const value = Date.UTC(year, month, day, hours, minutes);
  const parsed = new Date(value);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hours ||
    parsed.getUTCMinutes() !== minutes
  ) {
    return null;
  }

  return value;
}
