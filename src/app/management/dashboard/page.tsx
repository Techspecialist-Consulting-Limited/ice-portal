"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import { useCurrentUser } from "../../auth/current-user-provider";
import { getIncidentStateServerSnapshot, getIncidentStateSnapshot, subscribeToIncidentState } from "../../incidents/incident-state";
import { getAlertStateServerSnapshot, getAlertStateSnapshot, subscribeToAlertState } from "../../alerts/alert-state";
import { countActiveCriticalAlerts, summarizeAlertAcknowledgement } from "../../alerts/alert-metrics";
import { formatAlertRate, isActiveAlert } from "../../alerts/alert-status";
import { INCIDENT_STATUS_ORDER, isActiveIncident } from "../../incidents/incident-status";
import type { AlertItem, IncidentItem } from "../../dashboard/mock-data";
import { ManagementShell } from "../management-shell";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthlyAdoption = {
  current: { label: "October", signedIn: 684, feedReaders: 512 },
  previous: { label: "September", signedIn: 632, feedReaders: 468 },
};

function parseIncidentDate(value: string): Date | null {
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[2].toLowerCase());
  if (month < 0) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function incidentTimestamp(incident: IncidentItem): number | null {
  const parsed = parseIncidentDate(incident.reported);
  return parsed ? parsed.getTime() : null;
}

function alertTimestamp(alert: AlertItem): number | null {
  const parsed = new Date(alert.publishedAt ?? alert.updatedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function buildWeeklyActivity(incidents: IncidentItem[], alerts: AlertItem[]) {
  const timestamps = [
    ...incidents.map(incidentTimestamp),
    ...alerts.map(alertTimestamp),
  ].filter((timestamp): timestamp is number => timestamp !== null);

  if (timestamps.length === 0) return null;

  const latest = new Date(Math.max(...timestamps));
  const year = latest.getUTCFullYear();
  const month = latest.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const ranges = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: lastDay },
  ];

  return {
    month: `${MONTHS[month]} ${year}`,
    weeks: ranges.map(({ start, end }) => {
      const inRange = (timestamp: number | null) => {
        if (timestamp === null) return false;
        const date = new Date(timestamp);
        return date.getUTCFullYear() === year
          && date.getUTCMonth() === month
          && date.getUTCDate() >= start
          && date.getUTCDate() <= end;
      };
      return {
        label: `${start}–${end}`,
        incidents: incidents.filter((incident) => inRange(incidentTimestamp(incident))).length,
        alerts: alerts.filter((alert) => inRange(alertTimestamp(alert))).length,
      };
    }),
  };
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "primary",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  detail: string;
  tone?: "primary" | "danger" | "warning" | "info";
}) {
  const iconTone = {
    primary: "bg-[var(--primary-soft)] text-[var(--primary)]",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--card-foreground)] shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Overview
        </span>
      </div>
      <p className="mt-4 text-[12px] font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-[30px] font-semibold leading-9 tracking-tight text-[var(--foreground)]">{value}</p>
      <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
    </section>
  );
}

function SectionHeading({ title, detail, href, linkLabel }: { title: string; detail: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
      </div>
      {href && linkLabel && (
        <Link href={href} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]">
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function ActivityChart({ data }: { data: ReturnType<typeof buildWeeklyActivity> }) {
  if (!data || data.weeks.every((week) => week.incidents === 0 && week.alerts === 0)) {
    return (
      <p className="mt-5 rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-[12px] text-[var(--muted-foreground)]">
        Activity trend data is not available.
      </p>
    );
  }

  const maximum = Math.max(1, ...data.weeks.flatMap((week) => [week.incidents, week.alerts]));
  const summary = data.weeks
    .map((week) => `${week.label}: ${week.incidents} incidents, ${week.alerts} alerts`)
    .join("; ");

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--primary)]" />Incidents reported</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#80b99c]" />Alerts issued</span>
      </div>
      <div role="img" aria-label={`${data.month} weekly activity. ${summary}.`} className="grid grid-cols-4 gap-3">
        {data.weeks.map((week) => (
          <div key={week.label} className="min-w-0">
            <div className="flex h-36 items-end justify-center gap-2 border-b border-[var(--border)] px-1">
              <div className="flex h-full w-5 items-end" title={`${week.incidents} incidents reported`}>
                <span className="w-full rounded-t bg-[var(--primary)]" style={{ height: `${week.incidents === 0 ? 0 : Math.max(8, (week.incidents / maximum) * 100)}%` }} />
              </div>
              <div className="flex h-full w-5 items-end" title={`${week.alerts} alerts issued`}>
                <span className="w-full rounded-t bg-[#80b99c]" style={{ height: `${week.alerts === 0 ? 0 : Math.max(8, (week.alerts / maximum) * 100)}%` }} />
              </div>
            </div>
            <p className="mt-2 truncate text-center text-[10px] text-[var(--muted-foreground)]">Days {week.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">{data.month}</p>
    </div>
  );
}

export default function ManagementDashboardPage() {
  const currentUser = useCurrentUser();
  const incidents = useSyncExternalStore(subscribeToIncidentState, getIncidentStateSnapshot, getIncidentStateServerSnapshot);
  const alerts = useSyncExternalStore(subscribeToAlertState, getAlertStateSnapshot, getAlertStateServerSnapshot);

  const activeIncidents = useMemo(() => incidents.filter((incident) => isActiveIncident(incident.status)), [incidents]);
  const activeAlerts = useMemo(() => alerts.filter((alert) => isActiveAlert(alert.status)), [alerts]);
  const criticalIncidentCount = activeIncidents.filter((incident) => incident.priority === "Critical").length;
  const criticalAlerts = activeAlerts
    .filter((alert) => alert.priority === "Critical")
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
  const criticalAlertCount = countActiveCriticalAlerts(activeAlerts);
  const acknowledgement = summarizeAlertAcknowledgement(activeAlerts);
  const statusCounts = INCIDENT_STATUS_ORDER.map((status) => ({
    status,
    count: incidents.filter((incident) => incident.status === status).length,
  }));
  const maxStatusCount = Math.max(1, ...statusCounts.map(({ count }) => count));
  const weeklyActivity = useMemo(() => buildWeeklyActivity(incidents, alerts), [incidents, alerts]);

  const acknowledgementRate = acknowledgement.available
    ? formatAlertRate(acknowledgement.completionRate)
    : "Not available";
  const acknowledgementDetail = acknowledgement.available
    ? `${acknowledgement.acknowledged.toLocaleString()} of ${acknowledgement.targeted.toLocaleString()} recipients acknowledged`
    : "Some active alerts do not have complete recipient counts";

  return (
    <ManagementShell>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[12px] font-medium text-[var(--muted-foreground)]">Welcome, {currentUser.name}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[34px]">
            Executive dashboard
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--muted-foreground)]">
            A read-only view of incident activity, emergency communications, and organizational readiness.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[10px] font-medium text-[var(--muted-foreground)] shadow-sm">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          October 2026
        </span>
      </div>

      <nav aria-label="Dashboard sections" className="mb-4 flex flex-wrap gap-2">
        {[
          ["Incident summary", "#incident-summary"],
          ["Critical alerts", "#critical-alerts"],
          ["Activity trends", "#activity-trends"],
          ["Readiness", "#organizational-readiness"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {label}<ArrowDownRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section aria-label="Key operational indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          label="Active incidents"
          value={activeIncidents.length}
          detail="Open incidents across active workflow stages"
          tone="info"
        />
        <MetricCard
          icon={CircleAlert}
          label="Critical incidents"
          value={criticalIncidentCount}
          detail="Critical priority among active incidents"
          tone="danger"
        />
        <MetricCard
          icon={BellRing}
          label="Active critical alerts"
          value={criticalAlertCount}
          detail={`${activeAlerts.length} active alerts across all priorities`}
          tone="warning"
        />
        <MetricCard
          icon={CheckCheck}
          label="Acknowledgement rate"
          value={acknowledgementRate}
          detail={acknowledgementDetail}
          tone="primary"
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section id="incident-summary" aria-labelledby="incident-summary-title" className="scroll-mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
          <SectionHeading
            title="Incident summary"
            detail={`${activeIncidents.length} active incidents · ${criticalIncidentCount} critical`}
          />
          <div className="mt-5 space-y-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className="grid grid-cols-[minmax(90px,1fr)_2fr_2rem] items-center gap-3">
                <span className="truncate text-[11px] text-[var(--foreground)]">{status}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <span
                    className="block h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${count === 0 ? 0 : Math.max(5, (count / maxStatusCount) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-[11px] font-semibold tabular-nums text-[var(--foreground)]">{count}</span>
              </div>
            ))}
          </div>
          <p id="incident-summary-title" className="sr-only">Incident status totals</p>
        </section>

        <section id="critical-alerts" aria-labelledby="critical-alerts-title" className="scroll-mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
          <SectionHeading
            title="Critical alerts"
            detail={`${criticalAlertCount} active critical ${criticalAlertCount === 1 ? "alert" : "alerts"}`}
          />
          <h2 id="critical-alerts-title" className="sr-only">Active critical alerts</h2>
          {criticalAlerts.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {criticalAlerts.slice(0, 4).map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-[var(--foreground)]">{alert.title}</span>
                    <span className="mt-1 block truncate text-[10px] text-[var(--muted-foreground)]">
                      {alert.location} · {alert.status}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-[9px] font-semibold text-red-700">Critical</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-[11px] text-[var(--muted-foreground)]">
              No active critical alerts.
            </p>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section id="activity-trends" aria-labelledby="activity-trends-title" className="scroll-mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
          <SectionHeading
            title="Incident & alert activity"
            detail="Weekly incident reports and alerts"
          />
          <h2 id="activity-trends-title" className="sr-only">Incident and alert activity trends</h2>
          <ActivityChart data={weeklyActivity} />
        </section>

        <section id="organizational-readiness" aria-labelledby="readiness-title" className="scroll-mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5"        >
          <SectionHeading title="Organizational readiness" detail="Staff access and security feed engagement" />
          <h2 id="readiness-title" className="sr-only">Organizational readiness indicators</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-medium">Staff signed in</p>
              </div>
              <p className="mt-2 text-[24px] font-semibold leading-7 text-[var(--foreground)]">
                {monthlyAdoption.current.signedIn.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{monthlyAdoption.current.label} 2026</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <Activity className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-medium">Security feed readers</p>
              </div>
              <p className="mt-2 text-[24px] font-semibold leading-7 text-[var(--foreground)]">
                {monthlyAdoption.current.feedReaders.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">Opened at least one feed item</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium text-[var(--muted-foreground)]">Monthly feed readership</p>
              <p className="text-[12px] font-semibold text-[var(--foreground)]">
                {Math.round((monthlyAdoption.current.feedReaders / monthlyAdoption.current.signedIn) * 100)}%
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
              <span
                className="block h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${(monthlyAdoption.current.feedReaders / monthlyAdoption.current.signedIn) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              {monthlyAdoption.previous.label}: {monthlyAdoption.previous.signedIn.toLocaleString()} signed in · {monthlyAdoption.previous.feedReaders.toLocaleString()} feed readers
            </p>
          </div>
        </section>
      </div>
    </ManagementShell>
  );
}
