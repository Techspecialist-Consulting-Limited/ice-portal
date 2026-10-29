"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Download,
  FileBarChart,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import { getAlertStateServerSnapshot, getAlertStateSnapshot, subscribeToAlertState } from "../../alerts/alert-state";
import { getFeedStateServerSnapshot, getFeedStateSnapshot, subscribeToFeedState } from "../../security-feed/feed-state";
import { getIncidentStateServerSnapshot, getIncidentStateSnapshot, subscribeToIncidentState } from "../../incidents/incident-state";
import { buildCsv, downloadCsv } from "../../reports/report-export";
import type { ReportColumn } from "../../reports/report-types";
import { ManagementShell } from "../management-shell";
import {
  buildExecutiveReportRows,
  executiveReportCell,
  executiveReportCsvRows,
  EXECUTIVE_ADOPTION_SNAPSHOT,
  filterExecutiveReportSources,
  getExecutiveReportColumns,
  type ExecutiveReportKind,
} from "./executive-report-data";

const REPORT_TYPES: Array<{ value: ExecutiveReportKind; label: string }> = [
  { value: "summary", label: "Executive summary" },
  { value: "incidents", label: "Incident overview" },
  { value: "alerts", label: "Alert overview" },
  { value: "readiness", label: "Readiness & activity" },
];

const PERIOD_OPTIONS = [
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All available history", days: null },
] as const;

const CLIENT_NOW = Date.now();

function subscribeToClock() {
  return () => {};
}

function getClientNow() {
  return CLIENT_NOW;
}

function getServerNow() {
  return null;
}

function ReportCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof FileBarChart;
  label: string;
  value: string | number;
  detail: string;
  tone: "primary" | "danger" | "warning" | "info";
}) {
  const toneClass = {
    primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <p className="mt-3 text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-[26px] font-semibold leading-8 tabular-nums text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
    </section>
  );
}

function ExecutiveReportsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const incidents = useSyncExternalStore(subscribeToIncidentState, getIncidentStateSnapshot, getIncidentStateServerSnapshot);
  const alerts = useSyncExternalStore(subscribeToAlertState, getAlertStateSnapshot, getAlertStateServerSnapshot);
  const feeds = useSyncExternalStore(subscribeToFeedState, getFeedStateSnapshot, getFeedStateServerSnapshot);
  const now = useSyncExternalStore(subscribeToClock, getClientNow, getServerNow);
  const [activeReport, setActiveReport] = useState<ExecutiveReportKind>("summary");
  const [exportError, setExportError] = useState<string | null>(null);
  const period = PERIOD_OPTIONS.find((option) => option.value === searchParams.get("period")) ?? PERIOD_OPTIONS[0];

  const sources = useMemo(
    () => filterExecutiveReportSources({ incidents, alerts, feeds }, now, period.days),
    [alerts, feeds, incidents, now, period.days],
  );
  const reportRows = useMemo(
    () => buildExecutiveReportRows(activeReport, sources),
    [activeReport, sources],
  );
  const reportColumns = getExecutiveReportColumns(activeReport);
  const totals = useMemo(() => ({
    incidents: sources.incidents.length,
    activeIncidents: sources.incidents.filter((incident) =>
      ["Submitted", "Under review", "Verified", "Escalated", "Broadcast"].includes(incident.status),
    ).length,
    criticalAlerts: sources.alerts.filter((alert) => alert.priority === "Critical").length,
    feedItems: sources.feeds.length,
  }), [sources]);

  function updatePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("period");
    else params.set("period", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function exportReport() {
    try {
      const reportLabel = REPORT_TYPES.find((report) => report.value === activeReport)?.label ?? "Executive report";
      const generatedAt = now === null ? new Date().toISOString() : new Date(now).toISOString();
      const csvColumns: ReportColumn[] = reportColumns.map(({ key, label }) => ({ key, label }));
      const csv = buildCsv(csvColumns, executiveReportCsvRows(reportRows, reportColumns), [
        ["Report", reportLabel],
        ["Reporting period", period.label],
        ["Generated at (UTC)", generatedAt],
        ["Data scope", "Aggregate totals only; no individual incident, alert, staff or recipient records"],
      ]);
      downloadCsv(`ice-${activeReport}-report-${generatedAt.slice(0, 10)}.csv`, csv);
      setExportError(null);
    } catch {
      setExportError("The report could not be exported. No file was downloaded; please try again.");
    }
  }

  return (
    <ManagementShell>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Management User · Executive reporting</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">Executive reports</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
            Review and export organization-level summaries for incidents, alerts, and readiness.
          </p>
        </div>
        <div className="min-w-[190px]">
          <IceSelect label="Reporting period" icon={CalendarDays} value={period.value} options={PERIOD_OPTIONS} onChange={updatePeriod} />
        </div>
      </div>

      <section aria-label="Executive report highlights" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCard icon={ClipboardList} label="Incidents reported" value={totals.incidents} detail={period.label} tone="info" />
        <ReportCard icon={Activity} label="Active incidents" value={totals.activeIncidents} detail="Across active workflow stages" tone="primary" />
        <ReportCard icon={TriangleAlert} label="Critical alerts" value={totals.criticalAlerts} detail="Across all alert statuses" tone="danger" />
        <ReportCard icon={ShieldCheck} label="Feed items published" value={totals.feedItems} detail={`${period.label} · Feed publications`} tone="warning" />
      </section>

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Report preview</h2>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Aggregate summaries only. Staff adoption is the {EXECUTIVE_ADOPTION_SNAPSHOT.current.label} snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={exportReport}
            disabled={reportRows.length === 0}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
        <div role="group" aria-label="Choose report" className="mb-4 flex flex-wrap gap-2">
          {REPORT_TYPES.map((report) => (
            <button
              key={report.value}
              type="button"
              aria-pressed={activeReport === report.value}
              onClick={() => {
                setActiveReport(report.value);
                setExportError(null);
              }}
              className={`min-h-9 rounded-lg border px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                activeReport === report.value
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {report.label}
            </button>
          ))}
        </div>
        {exportError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{exportError}</p>
        )}
        {reportRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-[11px] text-[var(--muted-foreground)]">
            No report data is available for this period.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className={`w-full border-collapse text-left ${activeReport === "alerts" ? "min-w-[900px]" : activeReport === "incidents" ? "min-w-[700px]" : "min-w-[520px]"}`}>
              <caption className="sr-only">Aggregate executive report preview for {period.label}</caption>
              <thead className="bg-[var(--muted)]">
                <tr>
                  {reportColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)] ${column.key !== "measure" && column.key !== "category" ? "text-right" : ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {reportRows.map((row, index) => (
                  <tr key={`${row.section}-${row.measure}-${row.category}-${index}`} className="bg-[var(--card)]">
                    {reportColumns.map((column, columnIndex) => (
                      columnIndex === 0 ? (
                        <th
                          key={column.key}
                          scope="row"
                          className={`px-3 py-2.5 text-[11px] font-medium text-[var(--foreground)] ${column.key !== "measure" && column.key !== "category" ? "text-right tabular-nums" : ""}`}
                        >
                          {executiveReportCell(row, column.key)}
                        </th>
                      ) : (
                        <td
                          key={column.key}
                          className={`px-3 py-2.5 text-[11px] text-[var(--foreground)] ${column.key !== "measure" && column.key !== "category" ? "text-right tabular-nums" : ""}`}
                        >
                          {executiveReportCell(row, column.key)}
                        </td>
                      )
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ManagementShell>
  );
}

export default function ManagementExecutiveReportsPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <ExecutiveReportsWorkspace />
    </Suspense>
  );
}
