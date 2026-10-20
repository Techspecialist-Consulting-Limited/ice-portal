"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Info,
  MapPin,
  Pin,
  Plus,
  RadioTower,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import type { IncidentItem } from "./mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../incidents/incident-state";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "../alerts/alert-state";
import {
  AlertStatusBadge,
  formatAlertTimestamp,
  isActiveAlert,
  isAwaitingAcknowledgement,
} from "../alerts/alert-status";
import {
  countActiveAlerts,
  countActiveCriticalAlerts,
  countAlertsAwaitingAcknowledgement,
  summarizeAlertAcknowledgement,
} from "../alerts/alert-metrics";
import {
  getFeedStateServerSnapshot,
  getFeedStateSnapshot,
  subscribeToFeedState,
} from "../security-feed/feed-state";
import { formatFeedTimestamp, isPublished } from "../security-feed/feed-status";
import {
  INCIDENT_STATUS_ORDER,
  PriorityBadge,
  StatusBadge,
  incidentStatusBarColor,
  isActiveIncident,
  isReviewRequired,
} from "../incidents/incident-status";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { useCurrentUser } from "../auth/current-user-provider";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type QueueFilters = {
  category?: string;
  priority?: string;
  location?: string;
  period?: string;
};

// Single helper for every dashboard → queue deep link. Only valid, non-default
// filter values are ever written to the URL, and the queue reads these keys on
// first render, so a filtered queue survives refresh.
function queueHref({ status, scope, search, category, priority, location, period }: QueueFilters & { status?: string; scope?: string; search?: string }) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (scope && scope !== "all") params.set("scope", scope);
  if (category && category !== "all") params.set("category", category);
  if (priority && priority !== "all") params.set("priority", priority);
  if (location && location !== "all") params.set("location", location);
  if (status && status !== "all") params.set("status", status);
  if (period && period !== "all") params.set("period", period);
  const query = params.toString();
  return query ? `/incidents?${query}` : "/incidents";
}

type AlertQuery = { scope?: string; ack?: string; priority?: string };

// Deep links from the dashboard into the Alerts & Advisories page, mirroring the
// queueHref convention so a filtered alert view survives refresh.
function alertHref({ scope, ack, priority }: AlertQuery) {
  const params = new URLSearchParams();
  if (scope && scope !== "all") params.set("scope", scope);
  if (ack && ack !== "all") params.set("ack", ack);
  if (priority && priority !== "all") params.set("priority", priority);
  const query = params.toString();
  return query ? `/alerts?${query}` : "/alerts";
}

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
];

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  const percent = (value / total) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

function parseReported(value: string): number | null {
  const datePart = value.split("·")[0]?.trim() ?? "";
  const match = datePart.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1])).getTime();
}

// The current time is resolved on the client only (after mount) so the
// prerender never depends on an unstable `Date.now()` value.
function periodCutoff(period: string, now: number | null): number | null {
  if (now === null) return null;
  if (period === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (period === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

const toneIconClasses: Record<"red" | "amber" | "green" | "blue", string> = {
  red: "bg-[#fee2e2] text-[#991b1b]",
  amber: "bg-[#fff4d6] text-[#9a6700]",
  green: "bg-[#eaf7ee] text-[#166534]",
  blue: "bg-[#eaf3ff] text-[#1d4ed8]",
};

function FilterControl({
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

function KpiCard({
  icon: Icon,
  tone,
  title,
  value,
  subtitle,
  href,
}: {
  icon: typeof MapPin;
  tone: "red" | "amber" | "green" | "blue";
  title: string;
  value: ReactNode;
  subtitle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneIconClasses[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <ArrowRight className="mt-1.5 h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={2} />
      </div>
      <div className="mt-3 text-[13px] font-medium text-[var(--muted-foreground)]">{title}</div>
      <div className="mt-1.5 text-[30px] font-semibold leading-none text-[var(--foreground)]">{value}</div>
      <div className="mt-2 text-[12px] text-[var(--muted-foreground)]">{subtitle}</div>
    </Link>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]">
      {children}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
    </Link>
  );
}

function AlertSeverityIcon({ priority }: { priority: IncidentItem["priority"] }) {
  const className =
    priority === "Critical" ? toneIconClasses.red : priority === "Advisory" ? toneIconClasses.amber : toneIconClasses.blue;
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", className)}>
      {priority === "Informational" ? <Info className="h-[18px] w-[18px]" strokeWidth={2} /> : <TriangleAlert className="h-[18px] w-[18px]" strokeWidth={2} />}
    </span>
  );
}

export default function RiskDashboardPage() {
  const currentUser = useCurrentUser();
  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  // Alerts come from the shared alert store so withdraw/close on the Alerts page
  // is reflected here without a reload.
  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  // Security feed comes from the same shared store the Security Feed page uses,
  // so publish/pin/withdraw there is reflected here without a reload.
  const feedList = useSyncExternalStore(
    subscribeToFeedState,
    getFeedStateSnapshot,
    getFeedStateServerSnapshot,
  );

  const [period, setPeriod] = useState("all");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [location, setLocation] = useState("all");
  const [recentIncidentPage, setRecentIncidentPage] = useState(1);
  // Resolve "now" once on the client only. On the server this stays null so the
  // prerender never depends on an unstable value; the default period is "all"
  // (no cutoff) so the first render is identical on both sides.
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const categoryOptions = useMemo(
    () => [{ value: "all", label: "All categories" }, ...Array.from(new Set(incidents.map((item) => item.category))).sort().map((value) => ({ value, label: value }))],
    [incidents],
  );
  const locationOptions = useMemo(
    () => [{ value: "all", label: "All locations" }, ...Array.from(new Set(incidents.map((item) => item.location))).sort().map((value) => ({ value, label: value }))],
    [incidents],
  );
  const priorityOptions = [
    { value: "all", label: "All priorities" },
    { value: "Critical", label: "Critical" },
    { value: "Advisory", label: "Advisory" },
    { value: "Informational", label: "Informational" },
  ];

  const filters: QueueFilters = { category, priority, location, period };
  const hasActiveFilters = period !== "all" || category !== "all" || priority !== "all" || location !== "all";

  const resetFilters = () => {
    setRecentIncidentPage(1);
    setPeriod("all");
    setCategory("all");
    setPriority("all");
    setLocation("all");
  };

  const scopedIncidents = useMemo(() => {
    const cutoff = periodCutoff(period, now);
    return incidents.filter((incident) => {
      if (category !== "all" && incident.category !== category) return false;
      if (priority !== "all" && incident.priority !== priority) return false;
      if (location !== "all" && incident.location !== location) return false;
      if (cutoff !== null) {
        const reported = parseReported(incident.reported);
        if (reported === null || reported < cutoff) return false;
      }
      return true;
    });
  }, [incidents, now, period, category, priority, location]);
  const filteredIncidents = useMemo(
    () => scopedIncidents.filter((incident) => isActiveIncident(incident.status)),
    [scopedIncidents],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    INCIDENT_STATUS_ORDER.forEach((status) => {
      counts[status] = 0;
    });
    scopedIncidents.forEach((incident) => {
      counts[incident.status] = (counts[incident.status] ?? 0) + 1;
    });
    return counts;
  }, [scopedIncidents]);

  const maxStatusCount = Math.max(1, ...INCIDENT_STATUS_ORDER.map((status) => statusCounts[status] ?? 0));
  const reviewRequiredCount = filteredIncidents.filter((incident) => isReviewRequired(incident.status)).length;
  const recentIncidentPageSize = 5;
  const recentIncidentPageCount = Math.max(1, Math.ceil(filteredIncidents.length / recentIncidentPageSize));
  const currentRecentIncidentPage = Math.min(recentIncidentPage, recentIncidentPageCount);
  const firstVisibleRecentIncidentPage = Math.min(
    Math.max(1, currentRecentIncidentPage - 1),
    Math.max(1, recentIncidentPageCount - 2),
  );
  const visibleRecentIncidentPages = Array.from(
    { length: Math.min(3, recentIncidentPageCount) },
    (_, index) => firstVisibleRecentIncidentPage + index,
  );
  const recentIncidents = filteredIncidents.slice(
    (currentRecentIncidentPage - 1) * recentIncidentPageSize,
    currentRecentIncidentPage * recentIncidentPageSize,
  );

  // Priority also applies to alert activity (alerts carry the same priority scale).
  const scopedAlerts = priority === "all" ? alertList : alertList.filter((alert) => alert.priority === priority);
  const activeAlerts = scopedAlerts.filter((alert) => isActiveAlert(alert.status));
  // Counts come from the shared alert selectors so the dashboard KPIs and the
  // Alerts & Advisories summary cards always agree, and each card's link applies
  // exactly the filter its number was counted with.
  const activeAlertCount = countActiveAlerts(scopedAlerts);
  const awaitingAlertCount = countAlertsAwaitingAcknowledgement(activeAlerts);
  const activeCriticalAlertCount = countActiveCriticalAlerts(scopedAlerts);
  const ackSummary = summarizeAlertAcknowledgement(activeAlerts);
  const ackPercent =
    ackSummary.completionRate === null ? "Not available" : formatPercent(ackSummary.acknowledged, ackSummary.targeted);

  const alertBreakdown = (["Critical", "Advisory", "Informational"] as const)
    .map((level) => ({ level, count: activeAlerts.filter((alert) => alert.priority === level).length }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${entry.level.toLowerCase()}`)
    .join(" · ");

  const priorityRank = { Critical: 0, Advisory: 1, Informational: 2 } as const;
  const attentionAlerts = [...activeAlerts]
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
      const aPending = isAwaitingAcknowledgement(a) ? 0 : 1;
      const bPending = isAwaitingAcknowledgement(b) ? 0 : 1;
      return aPending - bPending;
    })
    .slice(0, 3);

  // Security feed activity is derived from the canonical feed records: the most
  // recently published items, plus published/pinned counts. No source health or
  // view metrics are shown because the prototype does not track them.
  const publishedFeed = feedList.filter((item) => isPublished(item.status));
  const pinnedFeedCount = feedList.filter((item) => item.pinned).length;
  const recentFeed = [...publishedFeed]
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt))
    .slice(0, 3);

  return (
    <IncidentPortalShell
      activeNav="dashboard"
      eyebrow={`Welcome back, ${currentUser.name}`}
      pageTitle="Risk dashboard"
      titleClassName="text-[32px] leading-[38px]"
      description="Monitor emerging risks, review incidents and keep your people informed."
      actions={
        <>
          <Link
            href={queueHref({ status: "Submitted", ...filters })}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] px-3.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={2} />
            Review incidents
          </Link>
          <Link
            href="/alerts"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Create alert
          </Link>
        </>
      }
    >
      <div className="grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-4">
        <FilterControl label="Reporting period" icon={CalendarDays} value={period} options={PERIOD_OPTIONS} onChange={(value) => { setPeriod(value); setRecentIncidentPage(1); }} />
        <FilterControl label="Category" icon={ClipboardList} value={category} options={categoryOptions} onChange={(value) => { setCategory(value); setRecentIncidentPage(1); }} />
        <FilterControl label="Priority" icon={TriangleAlert} value={priority} options={priorityOptions} onChange={(value) => { setPriority(value); setRecentIncidentPage(1); }} />
        <FilterControl label="Location" icon={MapPin} value={location} options={locationOptions} onChange={(value) => { setLocation(value); setRecentIncidentPage(1); }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--muted-foreground)]">
        <span>Filters apply to incident data; priority also applies to alert activity.</span>
        {hasActiveFilters && (
          <button type="button" onClick={resetFilters} className="font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]">
            Reset filters
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          tone="blue"
          title="Active incidents"
          value={filteredIncidents.length}
          subtitle={`${reviewRequiredCount} submitted need review`}
          href={queueHref({ ...filters, scope: "active" })}
        />
        <KpiCard
          icon={TriangleAlert}
          tone="red"
          title="Active alerts"
          value={activeAlertCount}
          subtitle={alertBreakdown || "No active alerts"}
          href={alertHref({ scope: "active", priority })}
        />
        <KpiCard
          icon={UsersRound}
          tone="amber"
          title="Awaiting acknowledgement"
          value={!ackSummary.available ? "Unavailable" : awaitingAlertCount}
          subtitle={!ackSummary.available ? "Recipient counts unavailable for some alerts" : `${ackSummary.outstanding} recipients still to acknowledge`}
          href={alertHref({ ack: "outstanding", priority })}
        />
        <KpiCard
          icon={CircleCheck}
          tone="green"
          title="Acknowledgement completion"
          value={ackPercent}
          subtitle={!ackSummary.available ? "Recipient totals unavailable" : `${ackSummary.acknowledged} of ${ackSummary.targeted} recipients`}
          href="/reports"
        />
      </div>

      <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Recent incidents</h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              Newest reports first · {reviewRequiredCount} submitted {reviewRequiredCount === 1 ? "incident" : "incidents"} await review
            </p>
          </div>
          <PanelLink href={queueHref(filters)}>View incident queue</PanelLink>
        </div>

        {recentIncidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-[13px] text-[var(--muted-foreground)]">No incidents match the current filters.</p>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]">
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Reference / Incident</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Category</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Location</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Priority</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Status</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Reported</th>
                    <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncidents.map((incident) => (
                    <tr key={incident.id} className="group text-[13px] text-[var(--foreground)] hover:bg-[var(--muted)]">
                      <td className="border-b border-[var(--border)] px-3 py-2.5">
                        <Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="block">
                          <div className="font-medium group-hover:text-[var(--primary)]">{incident.title}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{incident.id}</div>
                        </Link>
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">{incident.category}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">{incident.location}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5">
                        <PriorityBadge priority={incident.priority} />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5">
                        <StatusBadge status={incident.status} />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">{incident.reported}</td>
                      <td className="border-b border-[var(--border)] px-3 py-2.5 text-right">
                        <Link
                          href={`/incidents/${encodeURIComponent(incident.id)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        >
                          Review
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)]">
              <span>
                Showing {recentIncidents.length} of {filteredIncidents.length} active {filteredIncidents.length === 1 ? "incident" : "incidents"}
              </span>
              {recentIncidentPageCount > 1 && (
                <nav className="flex items-center gap-1" aria-label="Recent incident pages">
                  <button
                    type="button"
                    onClick={() => setRecentIncidentPage((page) => Math.max(1, page - 1))}
                    disabled={currentRecentIncidentPage === 1}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &lt;
                  </button>
                  {visibleRecentIncidentPages.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setRecentIncidentPage(pageNumber)}
                      aria-current={pageNumber === currentRecentIncidentPage ? "page" : undefined}
                      aria-label={`Page ${pageNumber}`}
                      className={cn(
                        "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2",
                        pageNumber === currentRecentIncidentPage
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-[var(--border)] bg-white text-[var(--foreground)]",
                      )}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRecentIncidentPage((page) => Math.min(recentIncidentPageCount, page + 1))}
                    disabled={currentRecentIncidentPage === recentIncidentPageCount}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &gt;
                  </button>
                </nav>
              )}
            </div>
          </>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Alerts requiring attention</h2>
              <span className="rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11px] font-medium text-[#991b1b]">
                {activeCriticalAlertCount} critical · {awaitingAlertCount} pending acknowledgement
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <PanelLink href="/alerts/escalations">Escalation history</PanelLink>
              <PanelLink href="/alerts">View all alerts</PanelLink>
            </div>
          </div>

          {attentionAlerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--muted-foreground)]">
              No alerts match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {attentionAlerts.map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <AlertSeverityIcon priority={alert.priority} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={alert.priority} />
                        <AlertStatusBadge status={alert.status} />
                      </div>
                      <div className="mt-1.5 truncate text-[14px] font-medium text-[var(--foreground)]">{alert.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                        <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} />
                        {alert.location} · {formatAlertTimestamp(alert.updatedAt)}
                      </div>
                    </div>
                  </div>

                  <PanelLink href={`/alerts/${encodeURIComponent(alert.id)}`}>View alert</PanelLink>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Security feed activity</h2>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {publishedFeed.length} published {publishedFeed.length === 1 ? "item" : "items"} · {pinnedFeedCount} pinned
              </p>
            </div>
            <PanelLink href="/security-feed">Manage feed</PanelLink>
          </div>

          {recentFeed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--muted-foreground)]">
              No published feed items yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentFeed.map((item) => (
                <Link
                  key={item.id}
                  href={`/security-feed/${encodeURIComponent(item.id)}`}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 transition-colors hover:border-[var(--primary)]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                    <RadioTower className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" strokeWidth={2} aria-label="Pinned" />}
                      <span className="truncate text-[13px] font-medium text-[var(--foreground)]">{item.title}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                      {formatFeedTimestamp(item.publishedAt ?? item.updatedAt)} · {item.source}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Incident status</h2>
          <PanelLink href={queueHref(filters)}>View queue</PanelLink>
        </div>
        <p className="mb-4 text-[12px] text-[var(--muted-foreground)]">
          {filteredIncidents.length} active {filteredIncidents.length === 1 ? "incident" : "incidents"} · by current workflow stage
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {INCIDENT_STATUS_ORDER.map((status) => {
            const count = statusCounts[status] ?? 0;
            const width = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
            return (
              <Link
                key={status}
                href={queueHref({ status, ...filters })}
                className="block rounded-lg px-1 py-1 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--foreground)]">
                  <span>{status}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                  <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: incidentStatusBarColor(status) }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </IncidentPortalShell>
  );
}
