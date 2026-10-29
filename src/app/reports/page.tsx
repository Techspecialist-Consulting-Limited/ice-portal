"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { AlertLifecycleStatus, IncidentItem } from "../dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "../alerts/alert-state";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../incidents/incident-state";
import { AlertStatusBadge, formatAlertTimestamp } from "../alerts/alert-status";
import { IncidentTypeBadge, PriorityBadge, StatusBadge } from "../incidents/incident-status";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { Toast } from "../alerts/alert-dialog";
import { useCurrentUser } from "../auth/current-user-provider";
import {
  DATE_PRESET_OPTIONS,
  DEFAULT_DATE_RANGE,
  FILTER_META,
  REPORT_DEFINITIONS,
  getReportDefinition,
  type DateRangePreset,
  type ReportDateRange,
  type ReportDefinition,
  type ReportFilterKey,
  type ReportKind,
} from "./report-types";
import {
  buildAlertRecords,
  buildEscalationRecords,
  buildIncidentRecords,
  dateRangeLabel,
  derivedOptions,
  filterRecords,
  resolveDateRange,
  sortRecords,
  type ReportFilters,
  type ReportRecord,
  type ReportSortState,
} from "./report-selectors";
import { buildXlsxWorkbook, downloadXlsx, xlsxFilename } from "./report-export";

const PAGE_SIZE = 10;
const REPORT_LOCATION_EVENT = "reports:locationchange";
const DATA_SOURCE_LABEL = "ICE 2.0 incident, alert and escalation records";

const FILTER_ICONS: Record<ReportFilterKey, typeof MapPin> = {
  priority: TriangleAlert,
  status: SlidersHorizontal,
  category: ClipboardList,
  audience: UsersRound,
  location: MapPin,
  ack: CheckCircle2,
  department: ClipboardList,
  assignee: UserRound,
  reportType: ClipboardList,
  reviewStatus: CheckCircle2,
  escalationType: ArrowUpRight,
  escalationStatus: SlidersHorizontal,
  targetGroup: UsersRound,
};

const REPORT_KIND_OPTIONS = REPORT_DEFINITIONS.map((definition) => ({
  value: definition.kind,
  label: definition.shortName,
  icon: definition.icon,
}));

const PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "Critical", label: "Critical" },
  { value: "Advisory", label: "Advisory" },
  { value: "Informational", label: "Informational" },
];

const ACK_FILTER_OPTIONS = [
  { value: "all", label: "All acknowledgement states" },
  { value: "outstanding", label: "Outstanding" },
  { value: "complete", label: "Complete" },
  { value: "unavailable", label: "Unavailable" },
  { value: "not_required", label: "Not required" },
];

const ESCALATION_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All escalation types" },
  { value: "Incident", label: "Incident escalations" },
  { value: "Alert", label: "Alert escalations" },
];

type FilterOption = { value: string; label: string };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function subscribeToReportLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(REPORT_LOCATION_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(REPORT_LOCATION_EVENT, onChange);
  };
}

function getReportLocationSnapshot() {
  return `${window.location.pathname}${window.location.search}`;
}

function getServerReportLocationSnapshot() {
  return "/reports";
}

// One clock reading for the reporting-period boundary. It is captured on the
// client only, so the server render and the hydration render agree on the row
// count, then the client re-renders with the real boundary.
let clientClock: number | null = null;

function subscribeToClock() {
  return () => {};
}

function getClockSnapshot() {
  if (clientClock === null) clientClock = Date.now();
  return clientClock;
}

function getServerClockSnapshot(): number | null {
  return null;
}

function optionsForFilter(key: ReportFilterKey, records: ReportRecord[]): FilterOption[] {
  switch (key) {
    case "priority":
      return PRIORITY_FILTER_OPTIONS;
    case "ack":
      return ACK_FILTER_OPTIONS;
    case "escalationType":
      return ESCALATION_TYPE_FILTER_OPTIONS;
    default:
      return derivedOptions(records, key, FILTER_META[key].allLabel);
  }
}

function filterValueLabel(key: ReportFilterKey, value: string, records: ReportRecord[]): string {
  return optionsForFilter(key, records).find((option) => option.value === value)?.label ?? value;
}

function countActiveFilters(definition: ReportDefinition, filters: ReportFilters): number {
  return definition.filters.filter((key) => {
    const value = filters[key];
    return Boolean(value) && value !== "all";
  }).length;
}

// Filters survive a report-type change only when the new dataset can produce the
// same value; everything else is dropped rather than left to filter silently.
function reconcileFilters(
  filters: ReportFilters,
  definition: ReportDefinition,
  records: ReportRecord[],
): ReportFilters {
  const next: ReportFilters = {};
  for (const key of definition.filters) {
    const value = filters[key];
    if (!value || value === "all") continue;
    if (optionsForFilter(key, records).some((option) => option.value === value)) {
      next[key] = value;
    }
  }
  return next;
}

function describeFilters(
  definition: ReportDefinition,
  filters: ReportFilters,
  records: ReportRecord[],
  query: string,
): string {
  const parts = definition.filters
    .map((key) => {
      const value = filters[key];
      if (!value || value === "all") return null;
      return `${FILTER_META[key].label}: ${filterValueLabel(key, value, records)}`;
    })
    .filter((part): part is string => Boolean(part));
  if (query.trim()) parts.push(`Search: "${query.trim()}"`);
  return parts.length > 0 ? parts.join(" · ") : "No additional filters";
}

function ResultsTable({
  definition,
  records,
  sort,
  onSort,
}: {
  definition: ReportDefinition;
  records: ReportRecord[];
  sort: ReportSortState | null;
  onSort: (key: string) => void;
}) {
  const minWidth = definition.kind === "incident" ? "min-w-[1120px]" : "min-w-[940px]";
  const longTextColumns = new Set(["title", "subject", "reason"]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className={cn("w-full border-separate border-spacing-0 text-left", minWidth)}>
        <caption className="sr-only">
          {definition.name}: {records.length} filtered {records.length === 1 ? "record" : "records"}
        </caption>
        <thead>
          <tr className="bg-[var(--muted)] text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {definition.columns.map((column) => {
              const sorted = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sorted ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                  className="border-b border-[var(--border)] px-3 py-2.5 font-medium"
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1 rounded text-left uppercase tracking-[0.12em] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {sorted ? (
                        sort?.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-45" strokeWidth={2} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={`${record.cells.reference ?? "row"}-${index}`} className="align-top text-[13px] hover:bg-[var(--muted)]">
              {definition.columns.map((column, columnIndex) => {
                const value = record.cells[column.key] ?? "—";
                const cellClass = "border-b border-[var(--border)] px-3 py-2.5 align-top";
                const content =
                  column.badge === "priority" ? (
                    <PriorityBadge priority={value as IncidentItem["priority"]} />
                  ) : column.badge === "alertStatus" ? (
                    <AlertStatusBadge status={value as AlertLifecycleStatus} />
                  ) : column.badge === "incidentStatus" ? (
                    <StatusBadge status={value as IncidentItem["status"]} />
                  ) : column.badge === "incidentType" ? (
                    <IncidentTypeBadge incidentType={value} />
                  ) : column.link && record.href ? (
                    <Link
                      href={record.href}
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium tabular-nums text-[var(--primary)] hover:text-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      {value}
                      <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className={cn(column.key === "reference" && "font-medium tabular-nums")}>{value}</span>
                  );

                if (columnIndex === 0) {
                  return (
                    <th key={column.key} scope="row" className={cn(cellClass, "whitespace-nowrap font-medium")}>
                      {content}
                    </th>
                  );
                }

                return (
                  <td
                    key={column.key}
                    className={cn(
                      cellClass,
                      longTextColumns.has(column.key)
                        ? "max-w-[320px] text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--primary-softest)] px-2.5 py-1 text-[11px] font-medium text-[var(--primary)]">
      {label}
    </span>
  );
}

export default function ReportsPage() {
  const alertList = useSyncExternalStore(subscribeToAlertState, getAlertStateSnapshot, getAlertStateServerSnapshot);
  const incidentList = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const reportLocation = useSyncExternalStore(
    subscribeToReportLocation,
    getReportLocationSnapshot,
    getServerReportLocationSnapshot,
  );
  const currentUser = useCurrentUser();

  const [kind, setKind] = useState<ReportKind>("alert");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<ReportDateRange>(DEFAULT_DATE_RANGE);
  const [sort, setSort] = useState<ReportSortState | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  // Read the clock through an external store so the server snapshot (null) and the
  // hydration render agree, then the client re-renders with the real boundary.
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);

  // The URL-sync effect needs the current report type without listing it as a
  // dependency (that would re-run the effect on its own state update). Refs are
  // written in an effect, never during render.
  const kindRef = useRef(kind);
  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);
  const toastTimer = useRef<number | null>(null);

  const recordsByKind = useMemo(
    () => ({
      alert: buildAlertRecords(alertList),
      incident: buildIncidentRecords(incidentList),
      escalation: buildEscalationRecords(alertList, incidentList),
    }),
    [alertList, incidentList],
  );

  const definition = getReportDefinition(kind);
  const sourceRecords = recordsByKind[kind];
  const resolvedRange = useMemo(() => resolveDateRange(range, now), [range, now]);

  // Derived filters only appear when the data can populate them, so a dropdown is
  // never empty or offers a value the source cannot produce.
  const visibleFilters = useMemo(
    () => definition.filters.filter((key) => optionsForFilter(key, sourceRecords).length > 1),
    [definition.filters, sourceRecords],
  );

  const filteredRecords = useMemo(() => {
    // An invalid custom range must not silently widen the results to everything.
    if (resolvedRange.error) return [];
    return sortRecords(filterRecords(sourceRecords, filters, resolvedRange, query), sort, definition.columns);
  }, [sourceRecords, filters, resolvedRange, query, sort, definition.columns]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = filteredRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredRecords.length);
  const pageRows = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const appliedFilters = useMemo(() => {
    const parts = definition.filters
      .map((key) => {
        const value = filters[key];
        if (!value || value === "all") return null;
        return `${FILTER_META[key].label}: ${filterValueLabel(key, value, sourceRecords)}`;
      })
      .filter((part): part is string => Boolean(part));
    if (query.trim()) parts.push(`Search: “${query.trim()}”`);
    return parts;
  }, [definition.filters, filters, query, sourceRecords]);

  const activeFilterCount = countActiveFilters(definition, filters);
  const resetEnabled =
    activeFilterCount > 0 ||
    query.trim().length > 0 ||
    range.preset !== DEFAULT_DATE_RANGE.preset ||
    Boolean(range.start) ||
    Boolean(range.end);

  const showRangeError = range.preset === "custom" && Boolean(resolvedRange.error);

  const showToast = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Keep the URL and the selected report in step. `?report=` is the only piece of
  // state in the URL, so legacy deep links keep working without a config route.
  useEffect(() => {
    const raw = new URLSearchParams(reportLocation.split("?")[1] ?? "").get("report");

    if (raw === null) {
      if (kindRef.current !== "alert") {
        setFilters((current) => reconcileFilters(current, getReportDefinition("alert"), recordsByKind.alert));
        setKind("alert");
        setPage(1);
        setSort(null);
        setExportError(null);
      }
      return;
    }

    const nextDefinition = REPORT_DEFINITIONS.find((item) => item.kind === raw);
    if (!nextDefinition) {
      window.history.replaceState(null, "", "/reports");
      window.dispatchEvent(new Event(REPORT_LOCATION_EVENT));
      return;
    }

    if (nextDefinition.kind === kindRef.current) return;

    setFilters((current) => reconcileFilters(current, nextDefinition, recordsByKind[nextDefinition.kind]));
    setKind(nextDefinition.kind);
    setPage(1);
    setSort(null);
    setExportError(null);
  }, [reportLocation, recordsByKind]);

  const changeKind = (next: ReportKind) => {
    if (next === kind) return;
    const nextDefinition = getReportDefinition(next);
    const nextFilters = reconcileFilters(filters, nextDefinition, recordsByKind[next]);
    const dropped = activeFilterCount - countActiveFilters(nextDefinition, nextFilters);

    setKind(next);
    setFilters(nextFilters);
    setPage(1);
    setSort(null);
    setExportError(null);
    window.history.pushState(null, "", `/reports?report=${next}`);
    window.dispatchEvent(new Event(REPORT_LOCATION_EVENT));

    if (dropped > 0) {
      showToast("Filters that do not apply to the selected report were cleared.");
    }
  };

  const updateFilter = (key: ReportFilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setExportError(null);
  };

  const updateRange = (next: Partial<ReportDateRange>) => {
    setRange((current) => ({ ...current, ...next }));
    setPage(1);
    setExportError(null);
  };

  const resetFilters = () => {
    setFilters({});
    setQuery("");
    setRange(DEFAULT_DATE_RANGE);
    setSort(null);
    setPage(1);
    setExportError(null);
  };

  const toggleSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
    setPage(1);
  };

  const handleExport = async () => {
    if (exporting || filteredRecords.length === 0 || resolvedRange.error) return;

    setExporting(true);
    setExportError(null);
    try {
      // Let the disabled/loading state paint before the workbook is assembled.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const generatedAt = new Date();
      const rows = filteredRecords.map((record) => record.cells);
      const bytes = buildXlsxWorkbook(
        {
          sheetName: definition.shortName,
          title: `${definition.name} — ICE 2.0`,
          meta: [
            ["Report", definition.name],
            ["Reporting period", dateRangeLabel(range)],
            ["Applied filters", describeFilters(definition, filters, sourceRecords, query)],
            ["Records", String(rows.length)],
            ["Generated at (UTC)", formatAlertTimestamp(generatedAt.toISOString())],
            ["Requested by", `${currentUser.name} (${currentUser.role})`],
            ["Data source", DATA_SOURCE_LABEL],
            ["Date basis", definition.dateBasisNote],
          ],
          columns: definition.columns,
          rows,
        },
        generatedAt,
      );
      const filename = xlsxFilename(kind, generatedAt);
      downloadXlsx(filename, bytes);
      showToast(`Created ${filename} with ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`);
    } catch {
      setExportError("The Excel workbook could not be created. No file was downloaded — please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportDisabled = exporting || filteredRecords.length === 0 || Boolean(resolvedRange.error);

  return (
    <IncidentPortalShell
      activeNav="reports"
      pageTitle="Reports"
      description="Review operational records, narrow them with filters, and export the exact results to Excel."
    >
      <p className="sr-only" aria-live="polite">
        {resolvedRange.error
          ? "The reporting period is invalid, so no results are shown."
          : `${filteredRecords.length} ${filteredRecords.length === 1 ? "record matches" : "records match"} the current filters.`}
      </p>

      <section
        aria-labelledby="report-filters-heading"
        className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="report-filters-heading" className="text-[16px] font-semibold text-[var(--foreground)]">
              Report
            </h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
              Choose a report type, then narrow the records. Results update as you change the filters — no separate
              configure or generate step.
            </p>
          </div>
          <p className="text-[11px] leading-4 text-[var(--muted-foreground)]">Data source: {DATA_SOURCE_LABEL}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <IceSelect
            label="Report type"
            icon={definition.icon}
            value={kind}
            options={REPORT_KIND_OPTIONS}
            onChange={(value) => changeKind(value as ReportKind)}
          />

          <IceSelect
            label="Reporting period"
            icon={CalendarRange}
            value={range.preset}
            options={DATE_PRESET_OPTIONS}
            onChange={(value) => updateRange({ preset: value as DateRangePreset })}
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="report-search"
              className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
            >
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <input
                id="report-search"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Reference, title, location"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-10 text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_rgba(8,116,67,0.18)] focus-visible:outline-none"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {range.preset === "custom" && (
            <>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  Start date
                </span>
                <input
                  type="date"
                  value={range.start}
                  aria-invalid={showRangeError}
                  onChange={(event) => updateRange({ preset: "custom", start: event.target.value })}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  End date
                </span>
                <input
                  type="date"
                  value={range.end}
                  aria-invalid={showRangeError}
                  onChange={(event) => updateRange({ preset: "custom", end: event.target.value })}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground)]">
            <SlidersHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={2} aria-hidden="true" />
            Filters
          </h3>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!resetEnabled}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
              resetEnabled
                ? "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]"
                : "cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset filters
          </button>
        </div>

        {visibleFilters.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleFilters.map((key) => (
              <IceSelect
                key={key}
                label={FILTER_META[key].label}
                icon={FILTER_ICONS[key]}
                value={filters[key] ?? "all"}
                options={optionsForFilter(key, sourceRecords)}
                onChange={(value) => updateFilter(key, value)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
            The current data has no additional filterable values for this report type.
          </p>
        )}

        {showRangeError && (
          <p role="alert" className="mt-3 rounded-xl border border-[#f3c9c9] bg-[#fdf2f2] px-3 py-2 text-[12px] font-medium text-[#991b1b]">
            {resolvedRange.error}
          </p>
        )}
      </section>

      <section
        aria-labelledby="report-results-heading"
        className="mt-4 rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="report-results-heading" className="text-[16px] font-semibold text-[var(--foreground)]">
              Report results
            </h2>
            <p className="mt-1 text-[13px] text-[var(--foreground)]">
              {definition.shortName} · {filteredRecords.length}{" "}
              {filteredRecords.length === 1 ? "record" : "records"} · {dateRangeLabel(range)}
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--muted-foreground)]">{definition.dateBasisNote}</p>
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportDisabled}
              title={
                resolvedRange.error
                  ? "Correct the reporting period before exporting."
                  : filteredRecords.length === 0
                    ? "No records match the current filters."
                    : undefined
              }
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
                exportDisabled && "cursor-not-allowed opacity-50 hover:bg-[var(--primary)]",
              )}
            >
              {exporting ? (
                <LoaderCircle className="h-[18px] w-[18px] animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
              )}
              {exporting ? "Preparing Excel…" : "Export Excel (.xlsx)"}
            </button>
            <p className="text-[11px] text-[var(--muted-foreground)]">Exports every filtered row, not just this page.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {appliedFilters.length > 0 ? (
            appliedFilters.map((part) => <FilterChip key={part} label={part} />)
          ) : (
            <p className="text-[12px] text-[var(--muted-foreground)]">No additional filters applied.</p>
          )}
        </div>

        {exportError && (
          <p role="alert" className="mt-3 rounded-xl border border-[#f3c9c9] bg-[#fdf2f2] px-3 py-2 text-[13px] text-[#991b1b]">
            {exportError}
          </p>
        )}

        {filteredRecords.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {resolvedRange.error
                ? "Enter a valid reporting period to see results."
                : "No records match the selected filters."}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <ResultsTable definition={definition} records={pageRows} sort={sort} onSort={toggleSort} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--muted-foreground)]">
              <span>
                Showing {pageStart}–{pageEnd} of {filteredRecords.length}{" "}
                {filteredRecords.length === 1 ? "record" : "records"}
              </span>
              {pageCount > 1 && (
                <nav className="flex items-center gap-1" aria-label="Report result pages">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &lt;
                  </button>
                  <span className="px-2 tabular-nums">
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                    disabled={currentPage === pageCount}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &gt;
                  </button>
                </nav>
              )}
            </div>
          </>
        )}

        {definition.limitationNote && (
          <p className="mt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">{definition.limitationNote}</p>
        )}
      </section>

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
