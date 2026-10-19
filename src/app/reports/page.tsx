"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Construction,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
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
import { PriorityBadge, StatusBadge, ToneBadge } from "../incidents/incident-status";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { Toast } from "../alerts/alert-dialog";
import {
  ACK_OPTIONS,
  DATE_PRESET_OPTIONS,
  DEFAULT_DATE_RANGE,
  ESCALATION_TYPE_OPTIONS,
  FILTER_META,
  PRIORITY_OPTIONS,
  REPORT_AVAILABILITY_LABELS,
  REPORT_DEFINITIONS,
  getReportDefinition,
  reportAvailabilityLabel,
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
  buildSummary,
  dateRangeLabel,
  derivedOptions,
  filterRecords,
  resolveDateRange,
  type ReportFilters,
  type ReportRecord,
  type ReportStat,
} from "./report-selectors";
import { EXPORT_FORMATS, buildCsv, downloadCsv, isExportAvailable, type ExportFormat } from "./report-export";
import { CURRENT_USER } from "../auth/current-user";

type View = "landing" | "config" | "preview";
type Phase = "idle" | "generating" | "error";

type GeneratedReport = {
  rows: ReportRecord[];
  generatedAt: string;
  rangeLabel: string;
  filterSummary: string;
  stats: ReportStat[];
};

const REPORT_LOCATION_EVENT = "reports:locationchange";

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

const FILTER_ICONS: Record<ReportFilterKey, typeof MapPin> = {
  priority: TriangleAlert,
  status: SlidersHorizontal,
  category: ClipboardList,
  audience: UsersRound,
  location: MapPin,
  ack: CheckCircle2,
  department: ClipboardList,
  assignee: UserRound,
  escalationType: ArrowUpRight,
  targetGroup: UsersRound,
};

const EXPORT_ICONS: Record<ExportFormat, typeof Download> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: Download,
};

const DATA_SOURCE_LABEL = "ICE 2.0 incident, alert and security feed records";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function optionsForFilter(key: ReportFilterKey, records: ReportRecord[]) {
  switch (key) {
    case "priority":
      return PRIORITY_OPTIONS;
    case "ack":
      return ACK_OPTIONS;
    case "escalationType":
      return ESCALATION_TYPE_OPTIONS;
    default:
      return derivedOptions(records, key, FILTER_META[key].allLabel);
  }
}

function filterValueLabel(key: ReportFilterKey, value: string, records: ReportRecord[]) {
  return optionsForFilter(key, records).find((option) => option.value === value)?.label ?? value;
}

function describeFilters(definition: ReportDefinition, filters: ReportFilters, records: ReportRecord[]) {
  const parts = definition.filters
    .map((key) => {
      const value = filters[key];
      if (!value || value === "all") return null;
      return `${FILTER_META[key].label}: ${filterValueLabel(key, value, records)}`;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "No additional filters";
}

function FilterSelect({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: typeof MapPin;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-[var(--border)] bg-white pl-9 pr-9 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
        </span>
      </span>
    </label>
  );
}

// No report-generation history exists in this portal, so this section explains
// availability instead of inventing a "recent reports" list. Both columns are
// derived from REPORT_DEFINITIONS, so a report cannot appear here unless it is
// already defined, and the grouping always matches the cards above.
function ReportAvailabilityPanel() {
  const ready = REPORT_DEFINITIONS.filter((item) => item.sourceState === "connected");
  const pending = REPORT_DEFINITIONS.filter((item) => item.sourceState !== "connected");

  return (
    <section
      aria-labelledby="report-availability-heading"
      className="mt-5 rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="report-availability-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
          Report availability
        </h2>
        <p className="text-[12px] text-[var(--muted-foreground)]">
          System Administrator reports, such as the audit log, are not included in this workspace.
        </p>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Ready to configure
          </h3>
          <ul className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {ready.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.kind} className="flex items-start gap-2.5 py-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">{item.shortName}</p>
                    <p className="mt-0.5 text-[12px] leading-4 text-[var(--muted-foreground)]">{item.dateBasisNote}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {REPORT_AVAILABILITY_LABELS.connectionRequired}
          </h3>
          {pending.length === 0 ? (
            <p className="mt-2.5 border-t border-[var(--border)] pt-2.5 text-[12px] text-[var(--muted-foreground)]">
              Every defined report type has a connected source.
            </p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {pending.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.kind} className="flex items-start gap-2.5 py-2">
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{item.shortName}</p>
                        <p className="mt-0.5 text-[12px] leading-4 text-[var(--muted-foreground)]">
                          Requires its source data before it can be generated.
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportTypeCard({
  definition,
  href,
  onSelect,
}: {
  definition: ReportDefinition;
  href: string;
  onSelect: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const Icon = definition.icon;
  const ready = definition.sourceState === "connected";
  const noteId = `report-unavailable-${definition.kind}`;

  return (
    <article className="flex h-full flex-col rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <h3 className="min-w-0 text-[14px] font-semibold leading-5 text-[var(--foreground)]">{definition.shortName}</h3>
      </div>

      <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--muted-foreground)]">{definition.description}</p>

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <ToneBadge label={reportAvailabilityLabel(definition)} tone={ready ? "success" : "neutral"} />
        {ready ? (
          <Link
            href={href}
            onClick={onSelect}
            aria-label={`Configure report: ${definition.shortName}`}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-[13px] font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Configure report
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby={noteId}
              aria-label={`Configure report: ${definition.shortName} (connection required)`}
              className="mt-3 inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 text-[13px] font-medium text-[var(--muted-foreground)] opacity-70"
            >
              Configure report
            </button>
            <p id={noteId} className="mt-2 text-[11px] leading-4 text-[var(--muted-foreground)]">
              {REPORT_AVAILABILITY_LABELS.connectionRequired}: this report needs its source data before it can be
              generated.
            </p>
          </>
        )}
      </div>
    </article>
  );
}

function ResultsTable({ definition, records }: { definition: ReportDefinition; records: ReportRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {definition.columns.map((column) => (
              <th key={column.key} scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={`${record.cells.reference ?? "row"}-${index}`} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
              {definition.columns.map((column) => {
                const value = record.cells[column.key] ?? "—";
                return (
                  <td key={column.key} className="border-b border-[var(--border)] px-3 py-3 align-top">
                    {column.badge === "priority" ? (
                      <PriorityBadge priority={value as IncidentItem["priority"]} />
                    ) : column.badge === "alertStatus" ? (
                      <AlertStatusBadge status={value as AlertLifecycleStatus} />
                    ) : column.badge === "incidentStatus" ? (
                      <StatusBadge status={value as IncidentItem["status"]} />
                    ) : column.link && record.href ? (
                      <Link
                        href={record.href}
                        className="inline-flex items-center gap-1 font-medium tabular-nums text-[var(--primary)] hover:text-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      >
                        {value}
                        <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className={cn(column.key === "reference" ? "font-medium tabular-nums" : "text-[var(--muted-foreground)]")}>
                        {value}
                      </span>
                    )}
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

function MetadataList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</dt>
          <dd className="mt-1 text-[13px] leading-5 text-[var(--foreground)]">{value}</dd>
        </div>
      ))}
    </dl>
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

  const [view, setView] = useState<View>("landing");
  const [kind, setKind] = useState<ReportKind>("alert");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [range, setRange] = useState<ReportDateRange>(DEFAULT_DATE_RANGE);
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rangeAttempted, setRangeAttempted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const timeoutRef = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const startDateRef = useRef<HTMLInputElement>(null);

  const requestedKind = new URLSearchParams(reportLocation.split("?")[1] ?? "").get("report");
  const requestedDefinition = REPORT_DEFINITIONS.find((item) => item.kind === requestedKind);
  const routeKind = requestedDefinition?.sourceState === "connected" ? requestedDefinition.kind : null;
  const activeKind = routeKind ?? kind;
  const activeView: View = routeKind ? (view === "preview" ? "preview" : "config") : "landing";

  useEffect(() => {
    if (requestedKind && !routeKind) {
      window.history.replaceState(null, "", "/reports");
      window.dispatchEvent(new Event(REPORT_LOCATION_EVENT));
    }
  }, [requestedKind, routeKind]);

  useEffect(() => {
    const handlePopState = () => {
      const nextKind = new URLSearchParams(window.location.search).get("report");
      const nextDefinition = REPORT_DEFINITIONS.find((item) => item.kind === nextKind);

      if (nextDefinition?.sourceState === "connected") {
        setKind(nextDefinition.kind);
        setFilters({});
        setRange(DEFAULT_DATE_RANGE);
        setReport(null);
        setPhase("idle");
        setView("config");
      } else {
        setView("landing");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const definition = getReportDefinition(activeKind);
  const unavailable = definition.sourceState === "unavailable";

  const recordsByKind = useMemo(
    () => ({
      alert: buildAlertRecords(alertList),
      incident: buildIncidentRecords(incidentList),
      escalation: buildEscalationRecords(alertList, incidentList),
      usage: [] as ReportRecord[],
      contact: [] as ReportRecord[],
    }),
    [alertList, incidentList],
  );

  const sourceRecords = recordsByKind[activeKind];
  const resolvedRange = useMemo(() => resolveDateRange(range, now), [range, now]);

  // Derived filters only appear when the data can populate them, so a criteria
  // dropdown is never empty or offers a value the source cannot produce.
  const visibleFilters = useMemo(
    () => definition.filters.filter((key) => optionsForFilter(key, sourceRecords).length > 1),
    [definition.filters, sourceRecords],
  );

  const activeFilterCount = visibleFilters.filter((key) => {
    const value = filters[key];
    return Boolean(value) && value !== "all";
  }).length;

  const rangeChanged =
    range.preset !== DEFAULT_DATE_RANGE.preset || Boolean(range.start) || Boolean(range.end);
  const resetEnabled = activeFilterCount > 0 || rangeChanged;

  // Show the period error once the user engages with the custom range or submits.
  const showRangeError =
    range.preset === "custom" &&
    Boolean(resolvedRange.error) &&
    (rangeAttempted || Boolean(range.start) || Boolean(range.end));

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const openReport = (next: ReportKind, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", `/reports?report=${next}`);
    window.dispatchEvent(new Event(REPORT_LOCATION_EVENT));
    setKind(next);
    setFilters({});
    setRange(DEFAULT_DATE_RANGE);
    setReport(null);
    setPhase("idle");
    setExportError(null);
    setRangeAttempted(false);
    setView("config");
  };

  const returnToReports = () => {
    window.history.replaceState(null, "", "/reports");
    window.dispatchEvent(new Event(REPORT_LOCATION_EVENT));
    setView("landing");
  };

  const resetCriteria = () => {
    setFilters({});
    setRange(DEFAULT_DATE_RANGE);
    setRangeAttempted(false);
  };

  const generate = () => {
    if (unavailable) return;
    const resolved = resolveDateRange(range, now);
    if (resolved.error) {
      setRangeAttempted(true);
      startDateRef.current?.focus();
      return;
    }
    setExportError(null);
    setPhase("generating");
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try {
        const filtered = filterRecords(recordsByKind[activeKind], filters, resolved);
        setReport({
          rows: filtered,
          generatedAt: new Date().toISOString(),
          rangeLabel: dateRangeLabel(range),
          filterSummary: describeFilters(definition, filters, recordsByKind[activeKind]),
          stats: buildSummary(activeKind, filtered),
        });
        setPhase("idle");
        setView("preview");
      } catch {
        setPhase("error");
      }
    }, 0);
  };

  const exportReport = (format: ExportFormat) => {
    if (!report || !isExportAvailable(format)) return;
    try {
      const meta: Array<[string, string]> = [
        ["Report", definition.name],
        ["Reporting period", report.rangeLabel],
        ["Applied filters", report.filterSummary],
        ["Generated at", formatAlertTimestamp(report.generatedAt)],
        ["Data source", DATA_SOURCE_LABEL],
      ];
      const csv = buildCsv(definition.columns, report.rows.map((record) => record.cells), meta);
      downloadCsv(`ice-${activeKind}-report-${report.generatedAt.slice(0, 10)}.csv`, csv);
      setExportError(null);
      showToast(`Exported ${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"} to CSV.`);
    } catch {
      setExportError("We couldn't create the file. Nothing was downloaded — please try again.");
    }
  };

  const exportActions = report ? (
    <div className="flex flex-wrap items-center gap-2">
      {EXPORT_FORMATS.map((capability) => {
        const Icon = EXPORT_ICONS[capability.format];
        if (!capability.available) {
          return (
            <button
              key={capability.format}
              type="button"
              aria-disabled="true"
              title={capability.reason}
              className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 text-sm font-medium text-[var(--muted-foreground)]"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              Export {capability.label}
            </button>
          );
        }
        return (
          <button
            key={capability.format}
            type="button"
            onClick={() => exportReport(capability.format)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            Export {capability.label}
          </button>
        );
      })}
    </div>
  ) : null;

  const breadcrumbs = (
    <>
      <Link
        href="/reports"
        onClick={(event) => {
          if (activeView !== "landing") {
            event.preventDefault();
            returnToReports();
          }
        }}
        className="hover:text-[var(--primary)]"
      >
        Reports
      </Link>
      {activeView !== "landing" && (
        <>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">
            {activeView === "preview" ? definition.name : `Configure ${definition.shortName}`}
          </span>
        </>
      )}
    </>
  );

  const shellTitle = activeView === "landing" ? "Reports" : activeView === "config" ? `Configure ${definition.name}` : definition.name;
  const shellDescription =
    activeView === "landing"
      ? "Generate operational reports across incidents, alerts and emergency readiness."
      : activeView === "config"
        ? "Choose the reporting period and filters for the records you need."
        : definition.description;

  return (
    <IncidentPortalShell
      activeNav="reports"
      breadcrumbs={breadcrumbs}
      pageTitle={shellTitle}
      description={shellDescription}
      actions={activeView === "preview" ? exportActions : undefined}
    >
      <p className="sr-only" aria-live="polite">
        {activeView === "preview" && report ? `Report ready. ${report.rows.length} ${report.rows.length === 1 ? "row" : "rows"} returned.` : ""}
      </p>

      {activeView === "landing" && (
        <>
          <section aria-label="Report types" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORT_DEFINITIONS.map((item) => (
              <ReportTypeCard
                key={item.kind}
                definition={item}
                href={`/reports?report=${item.kind}`}
                onSelect={(event) => openReport(item.kind, event)}
              />
            ))}
          </section>

          <ReportAvailabilityPanel />
        </>
      )}

      {activeView === "config" && (
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <definition.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold text-[var(--foreground)]">{definition.name}</h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--muted-foreground)]">{definition.description}</p>
            </div>
            <ToneBadge
              label={reportAvailabilityLabel(definition)}
              tone={unavailable ? "neutral" : "success"}
            />
          </div>

          {unavailable ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#f0e2b8] bg-[#fffaf0] p-4">
              <Construction className="mt-0.5 h-5 w-5 shrink-0 text-[#9a6700]" strokeWidth={2} />
              <div className="min-w-0 text-[13px] leading-5 text-[#7a5a12]">
                <p>{definition.sourceNote}</p>
                <p className="mt-1">This report cannot be generated until that source is connected.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Reporting period</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted-foreground)]">{definition.dateBasisNote}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <FilterSelect
                    label="Reporting period"
                    icon={CalendarRange}
                    value={range.preset}
                    options={DATE_PRESET_OPTIONS}
                    onChange={(value) => {
                      setRange((current) => ({ ...current, preset: value as DateRangePreset }));
                      setRangeAttempted(false);
                    }}
                  />
                  {range.preset === "custom" && (
                    <>
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Start date</span>
                        <input
                          type="date"
                          ref={startDateRef}
                          value={range.start}
                          aria-invalid={showRangeError}
                          onChange={(event) => setRange((current) => ({ ...current, preset: "custom", start: event.target.value }))}
                          className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">End date</span>
                        <input
                          type="date"
                          value={range.end}
                          aria-invalid={showRangeError}
                          onChange={(event) => setRange((current) => ({ ...current, preset: "custom", end: event.target.value }))}
                          className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        />
                      </label>
                    </>
                  )}
                </div>
                {showRangeError && (
                  <p className="mt-2 text-[12px] font-medium text-[#c62828]">{resolvedRange.error}</p>
                )}
              </div>

              {visibleFilters.length > 0 && (
                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-[var(--foreground)]">Filters</h3>
                    <button
                      type="button"
                      onClick={resetCriteria}
                      disabled={!resetEnabled}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                        resetEnabled
                          ? "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]"
                          : "cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
                      )}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset criteria
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleFilters.map((key) => (
                      <FilterSelect
                        key={key}
                        label={FILTER_META[key].label}
                        icon={FILTER_ICONS[key]}
                        value={filters[key] ?? "all"}
                        options={optionsForFilter(key, sourceRecords)}
                        onChange={(value) => setFilters((current) => ({ ...current, [key]: value }))}
                      />
                    ))}
                  </div>
                </div>
              )}

              {phase === "error" && (
                <div className="mt-5 rounded-xl border border-dashed border-[#f3c9c9] bg-[#fdf2f2] px-4 py-3 text-[13px] text-[#991b1b]">
                  Something went wrong while building this report. Your criteria were kept — please try again.
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">
                  Export: CSV is available. PDF and Excel are not configured in this environment and are disabled.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={returnToReports}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to reports
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={phase === "generating"}
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
                      phase === "generating" && "cursor-wait opacity-80",
                    )}
                  >
                    {phase === "generating" ? (
                      <LoaderCircle className="h-[18px] w-[18px] animate-spin" strokeWidth={2} />
                    ) : (
                      <ClipboardList className="h-[18px] w-[18px]" strokeWidth={2} />
                    )}
                    {phase === "generating" ? "Generating…" : "Generate report"}
                  </button>
                </div>
              </div>
            </>
          )}

          {unavailable && (
            <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-5">
              <button
                type="button"
                onClick={returnToReports}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to reports
              </button>
            </div>
          )}
        </section>
      )}

      {activeView === "preview" && report && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setView("config")}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to configuration
            </button>
            <span aria-hidden="true" className="text-[var(--border)]">|</span>
            <Link href="/reports" onClick={returnToReports} className="text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              Back to reports
            </Link>
          </div>

          {exportError && (
            <div className="rounded-xl border border-[#f3c9c9] bg-[#fdf2f2] px-4 py-3 text-[13px] text-[#991b1b]">{exportError}</div>
          )}

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <MetadataList
              items={[
                ["Report", definition.name],
                ["Reporting period", report.rangeLabel],
                ["Applied filters", report.filterSummary],
                ["Generated", formatAlertTimestamp(report.generatedAt)],
                ["Requested by", `${CURRENT_USER.name} · ${CURRENT_USER.role}`],
                ["Data source", DATA_SOURCE_LABEL],
              ]}
            />
          </section>

          {report.stats.length > 0 && (
            <section aria-label="Report summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {report.stats.map((stat) => (
                <div key={stat.key} className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[24px] font-semibold leading-none tabular-nums text-[var(--foreground)]">{stat.value}</div>
                  <div className="mt-1.5 text-[12px] font-medium text-[var(--muted-foreground)]">{stat.label}</div>
                </div>
              ))}
            </section>
          )}

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Results</h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              {report.rows.length} {report.rows.length === 1 ? "record" : "records"} &middot; {report.rangeLabel} &middot; ICE 2.0 records
            </p>

            <div className="mt-4">
              {report.rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                  <p className="text-[13px] text-[var(--muted-foreground)]">No records match the selected filters.</p>
                  <button
                    type="button"
                    onClick={() => setView("config")}
                    className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
                  >
                    Back to configuration
                  </button>
                </div>
              ) : (
                <ResultsTable definition={definition} records={report.rows} />
              )}
            </div>

            {definition.limitationNote && (
              <p className="mt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">{definition.limitationNote}</p>
            )}
          </section>
        </div>
      )}

      {activeView === "preview" && !report && (
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-[13px] text-[var(--muted-foreground)]">No report is loaded.</p>
          <button
            type="button"
            onClick={() => setView("config")}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to configuration
          </button>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </IncidentPortalShell>
  );
}
