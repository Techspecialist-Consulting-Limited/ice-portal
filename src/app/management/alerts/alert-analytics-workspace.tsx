"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  RotateCcw,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { AlertItem } from "@/app/dashboard/mock-data";
import { getAlertStateServerSnapshot, getAlertStateSnapshot, subscribeToAlertState } from "../../alerts/alert-state";
import { ManagementShell } from "../management-shell";
import {
  ALERT_PERIOD_OPTIONS,
  ALERT_PRIORITY_OPTIONS,
  ALERT_STATUS_OPTIONS,
  filterAlerts,
  getAlertAnalyticsDimensionLabel,
  getAlertDistribution,
  getAlertValue,
  summarizeAlerts,
  type AlertAnalyticsDimension,
  type AlertAnalyticsFilters,
  type AlertDistributionItem,
} from "./alert-analytics";

const FILTER_DEFAULTS: AlertAnalyticsFilters = {
  period: "all",
  category: "all",
  priority: "all",
  status: "all",
  acknowledgement: "all",
};

const FILTER_FIELDS: Array<{
  key: keyof AlertAnalyticsFilters;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { key: "period", label: "Reporting period", icon: CalendarDays },
  { key: "category", label: "Category", icon: Tag },
  { key: "priority", label: "Priority", icon: TriangleAlert },
  { key: "status", label: "Status", icon: CircleAlert },
  { key: "acknowledgement", label: "Acknowledgement", icon: CheckCheck },
];

function readFilters(searchParams: URLSearchParams): AlertAnalyticsFilters {
  return {
    period: searchParams.get("period") ?? FILTER_DEFAULTS.period,
    category: searchParams.get("category") ?? FILTER_DEFAULTS.category,
    priority: searchParams.get("priority") ?? FILTER_DEFAULTS.priority,
    status: searchParams.get("status") ?? FILTER_DEFAULTS.status,
    acknowledgement: searchParams.get("acknowledgement") ?? FILTER_DEFAULTS.acknowledgement,
  };
}

function filtersToQuery(filters: AlertAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "all") params.set(key, value);
  });
  return params;
}

function FilterBar({
  filters,
  alerts,
  onChange,
  onReset,
}: {
  filters: AlertAnalyticsFilters;
  alerts: AlertItem[];
  onChange: (key: keyof AlertAnalyticsFilters, value: string) => void;
  onReset: () => void;
}) {
  const optionsByField: Record<keyof AlertAnalyticsFilters, string[]> = {
    period: ALERT_PERIOD_OPTIONS.map((option) => option.value),
    category: ["all", ...new Set(alerts.map((alert) => getAlertValue(alert, "category")))],
    priority: ["all", ...ALERT_PRIORITY_OPTIONS],
    status: ["all", ...ALERT_STATUS_OPTIONS],
    acknowledgement: ["all", "required", "not-required"],
  };

  function optionLabel(key: keyof AlertAnalyticsFilters, value: string) {
    if (key === "period") return ALERT_PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
    if (value === "all") {
      const labels: Record<keyof AlertAnalyticsFilters, string> = {
        period: "All time",
        category: "All categories",
        priority: "All priorities",
        status: "All statuses",
        acknowledgement: "All alerts",
      };
      return labels[key];
    }
    if (key === "acknowledgement") return value === "required" ? "Required" : "Not required";
    return value;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <h2 className="text-[12px] font-semibold text-[var(--foreground)]">Refine view</h2>
        <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Choose which alerts to include in the figures below.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FILTER_FIELDS.map(({ key, label, icon: Icon }) => (
          <IceSelect
            key={key}
            label={label}
            icon={Icon}
            value={filters[key]}
            options={optionsByField[key].map((value) => ({ value, label: optionLabel(key, value) }))}
            onChange={(value) => onChange(key, value)}
          />
        ))}
      </div>
      {Object.values(filters).some((value) => value !== "all") && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset filters
        </button>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof Bell;
  label: string;
  value: number | null;
  caption: string;
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
      <p className="mt-1 text-[27px] font-semibold leading-8 tabular-nums text-[var(--foreground)]">
        {value === null ? "Not available" : value.toLocaleString()}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)]">{caption}</p>
    </section>
  );
}

function DistributionCard({
  dimension,
  items,
}: {
  dimension: AlertAnalyticsDimension;
  items: AlertDistributionItem[];
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
            By {getAlertAnalyticsDimensionLabel(dimension).toLowerCase()}
          </h3>
          <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">Alert totals and acknowledgement progress in this view.</p>
        </div>
        <span className="text-[10px] text-[var(--muted-foreground)]">{items.length} {items.length === 1 ? "group" : "groups"}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-[11px] text-[var(--muted-foreground)]">
          No alerts match the selected filters.
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex min-w-max items-end gap-3 border-b border-[var(--border)] px-1">
              {items.map((item) => (
                <div key={item.value} title={`${item.value}: ${item.count} alerts`} className="flex w-[76px] flex-col items-center px-1 pt-2 sm:w-[96px]">
                  <span className="mb-2 text-[11px] font-semibold tabular-nums text-[var(--foreground)]">{item.count}</span>
                  <span className="flex h-40 w-full items-end justify-center">
                    <span
                      className="w-9 rounded-t-md bg-[var(--primary)] sm:w-11"
                      style={{ height: `${Math.max(6, (item.count / maximum) * 100)}%` }}
                    />
                  </span>
                  <span className="mt-2 min-h-9 w-full break-words text-center text-[10px] leading-4 text-[var(--muted-foreground)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <caption className="sr-only">Alert totals and acknowledgement progress by {getAlertAnalyticsDimensionLabel(dimension).toLowerCase()}</caption>
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)]">Group</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Total</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Live</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Critical</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Acknowledged</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <tr key={item.value} className="bg-[var(--card)]">
                    <th scope="row" className="px-3 py-2.5 text-[11px] font-medium text-[var(--foreground)]">{item.value}</th>
                    <td className="px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums text-[var(--foreground)]">{item.count}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{item.active}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{item.critical}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{item.acknowledged?.toLocaleString() ?? "Not available"}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{item.outstanding?.toLocaleString() ?? "Not available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AlertAnalyticsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const alerts = useSyncExternalStore(subscribeToAlertState, getAlertStateSnapshot, getAlertStateServerSnapshot);
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  const filters = readFilters(new URLSearchParams(searchParams.toString()));
  const [activeBreakdown, setActiveBreakdown] = useState<AlertAnalyticsDimension>("status");
  const filteredAlerts = useMemo(() => filterAlerts(alerts, filters, now), [alerts, filters, now]);
  const summary = summarizeAlerts(filteredAlerts);
  const distributions = {
    status: getAlertDistribution(filteredAlerts, "status"),
    priority: getAlertDistribution(filteredAlerts, "priority"),
    category: getAlertDistribution(filteredAlerts, "category"),
    acknowledgement: getAlertDistribution(filteredAlerts, "acknowledgement"),
  };

  function navigate(nextFilters: AlertAnalyticsFilters) {
    const params = filtersToQuery(nextFilters);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: keyof AlertAnalyticsFilters, value: string) {
    navigate({ ...filters, [key]: value });
  }

  function resetFilters() {
    navigate(FILTER_DEFAULTS);
  }

  return (
    <ManagementShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Management User · Alert analytics</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">
            Alert analytics
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
            Review alert activity and staff acknowledgement progress across the organization.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)]">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {ALERT_PERIOD_OPTIONS.find((option) => option.value === filters.period)?.label ?? "All time"}
        </span>
      </div>

      <FilterBar filters={filters} alerts={alerts} onChange={updateFilter} onReset={resetFilters} />
          <section aria-label="Alert summary metrics" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Bell} label="Live alerts" value={summary.active} caption={`${summary.total} alerts in view`} tone="info" />
            <SummaryCard icon={TriangleAlert} label="Critical alerts" value={summary.critical} caption="Across all statuses in view" tone="danger" />
            <SummaryCard icon={CheckCheck} label="Acknowledgements received" value={summary.acknowledged} caption="For alerts requiring acknowledgement" tone="primary" />
            <SummaryCard icon={CircleAlert} label="Acknowledgements outstanding" value={summary.outstanding} caption="For alerts requiring acknowledgement" tone="warning" />
          </section>

          {summary.total === 0 ? (
            <section className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">No alerts match these filters.</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Adjust the reporting period or reset the filters to see available analytics.</p>
            </section>
          ) : (
            <>
              <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
                <div className="mb-4">
                  <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Alert breakdown</h2>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Compare alert totals and acknowledgement progress.</p>
                </div>
                <div role="group" aria-label="Choose alert breakdown" className="mb-5 flex flex-wrap gap-2">
                  {(["status", "priority", "category", "acknowledgement"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={activeBreakdown === tab}
                      onClick={() => setActiveBreakdown(tab)}
                      className={`min-h-9 rounded-lg border px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                        activeBreakdown === tab
                          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {getAlertAnalyticsDimensionLabel(tab)}
                    </button>
                  ))}
                </div>
                <DistributionCard
                  dimension={activeBreakdown}
                  items={distributions[activeBreakdown]}
                />
              </section>
            </>
      )}
    </ManagementShell>
  );
}

export function AlertAnalyticsPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <AlertAnalyticsWorkspace />
    </Suspense>
  );
}
