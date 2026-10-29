"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  CheckCheck,
  Siren,
  UsersRound,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { IncidentType } from "@/app/dashboard/mock-data";
import {
  UNCLASSIFIED_INCIDENT_TYPE,
  incidentTypeLabel,
} from "../../incidents/incident-status";
import { summarizeAlertAcknowledgement } from "../../alerts/alert-metrics";
import { getAlertStateServerSnapshot, getAlertStateSnapshot, subscribeToAlertState } from "../../alerts/alert-state";
import { getIncidentStateServerSnapshot, getIncidentStateSnapshot, subscribeToIncidentState } from "../../incidents/incident-state";
import { parseIncidentReported } from "../../incidents/incident-reported";
import { getFeedStateServerSnapshot, getFeedStateSnapshot, subscribeToFeedState } from "../../security-feed/feed-state";
import { ManagementShell } from "../management-shell";

const ADOPTION_SNAPSHOT = {
  current: { label: "October", signedIn: 684, feedReaders: 512 },
  previous: { label: "September", signedIn: 632, feedReaders: 468 },
};

const PERIOD_OPTIONS = [
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All available history", days: null },
] as const;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

type MonthlyActivity = {
  key: string;
  label: string;
  incidents: number;
  alerts: number;
  feeds: number;
};

const INCIDENT_TYPES: Array<{ value: IncidentType | typeof UNCLASSIFIED_INCIDENT_TYPE; label: string }> = [
  { value: "SOS", label: "SOS requests" },
  { value: "Emergency Report", label: "Emergency reports" },
  { value: "Incident Report", label: "Incident reports" },
  { value: UNCLASSIFIED_INCIDENT_TYPE, label: UNCLASSIFIED_INCIDENT_TYPE },
];

function monthKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function eventTimestamp(value?: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildMonthlyActivity(
  incidents: ReturnType<typeof getIncidentStateSnapshot>,
  alerts: ReturnType<typeof getAlertStateSnapshot>,
  feeds: ReturnType<typeof getFeedStateSnapshot>,
  now: number,
  periodDays: number | null,
): MonthlyActivity[] {
  const incidentEvents = incidents.flatMap((incident) => {
    const timestamp = parseIncidentReported(incident.reported);
    return timestamp === null ? [] : [{ timestamp, kind: "incident" as const }];
  });
  const alertEvents = alerts.flatMap((alert) => {
    const timestamp = eventTimestamp(alert.publishedAt ?? alert.updatedAt);
    return timestamp === null ? [] : [{ timestamp, kind: "alert" as const }];
  });
  const feedEvents = feeds.flatMap((feed) => {
    const timestamp = eventTimestamp(feed.publishedAt);
    return timestamp === null ? [] : [{ timestamp, kind: "feed" as const }];
  });
  const allEvents = [...incidentEvents, ...alertEvents, ...feedEvents];
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000;
  const visibleEvents = allEvents.filter(({ timestamp }) =>
    (cutoff === null || timestamp >= cutoff) && timestamp <= now,
  );

  if (visibleEvents.length === 0) return [];

  const firstDate = new Date(cutoff ?? Math.min(...visibleEvents.map(({ timestamp }) => timestamp)));
  const lastDate = new Date(now);
  const monthKeys: string[] = [];
  const cursor = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1));
  while (cursor <= lastDate) {
    monthKeys.push(monthKey(cursor.getTime()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const totals = new Map(monthKeys.map((key) => [key, { incidents: 0, alerts: 0, feeds: 0 }]));
  visibleEvents.forEach(({ timestamp, kind }) => {
    const total = totals.get(monthKey(timestamp));
    if (!total) return;
    if (kind === "incident") total.incidents += 1;
    if (kind === "alert") total.alerts += 1;
    if (kind === "feed") total.feeds += 1;
  });

  return monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    ...totals.get(key)!,
  }));
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const change = current - previous;
  const percentage = previous > 0 ? Math.round((change / previous) * 100) : null;
  const positive = change >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${positive ? "text-[var(--primary)]" : "text-amber-700"}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {change >= 0 ? "+" : ""}{change.toLocaleString()}
      {percentage === null ? "" : ` (${percentage >= 0 ? "+" : ""}${percentage}%)`}
    </span>
  );
}

function AdoptionCard() {
  const currentRate = ADOPTION_SNAPSHOT.current.feedReaders / ADOPTION_SNAPSHOT.current.signedIn;
  const previousRate = ADOPTION_SNAPSHOT.previous.feedReaders / ADOPTION_SNAPSHOT.previous.signedIn;
  const percentagePointChange = (currentRate - previousRate) * 100;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Staff adoption</h2>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Monthly sign-ins and security feed readership</p>
        </div>
        <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)]">
          {ADOPTION_SNAPSHOT.current.label} 2026
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[var(--muted)] p-3">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            <p className="text-[10px] font-medium">Staff signed in</p>
          </div>
          <p className="mt-2 text-[24px] font-semibold leading-7 tabular-nums text-[var(--foreground)]">
            {ADOPTION_SNAPSHOT.current.signedIn.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">vs {ADOPTION_SNAPSHOT.previous.label}</span>
            <ChangeIndicator current={ADOPTION_SNAPSHOT.current.signedIn} previous={ADOPTION_SNAPSHOT.previous.signedIn} />
          </div>
        </div>
        <div className="rounded-lg bg-[var(--muted)] p-3">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <p className="text-[10px] font-medium">Security feed readers</p>
          </div>
          <p className="mt-2 text-[24px] font-semibold leading-7 tabular-nums text-[var(--foreground)]">
            {ADOPTION_SNAPSHOT.current.feedReaders.toLocaleString()}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">vs {ADOPTION_SNAPSHOT.previous.label}</span>
            <ChangeIndicator current={ADOPTION_SNAPSHOT.current.feedReaders} previous={ADOPTION_SNAPSHOT.previous.feedReaders} />
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-medium text-[var(--muted-foreground)]">Monthly feed readership</p>
          <p className="text-[12px] font-semibold tabular-nums text-[var(--foreground)]">{Math.round(currentRate * 100)}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${currentRate * 100}%` }} />
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
          {percentagePointChange >= 0 ? "+" : ""}{percentagePointChange.toFixed(1)} percentage points from {ADOPTION_SNAPSHOT.previous.label} ({Math.round(previousRate * 100)}%)
        </p>
      </div>
    </section>
  );
}

function ActivityTrend({ data }: { data: MonthlyActivity[] }) {
  const maximum = Math.max(1, ...data.flatMap((month) => [month.incidents, month.alerts, month.feeds]));

  if (data.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-[11px] text-[var(--muted-foreground)]">
        No dated incident, alert, or Security Feed activity is available for this period.
      </p>
    );
  }

  return (
    <>
      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max items-end gap-3 border-b border-[var(--border)] px-1">
          {data.map((month) => (
            <div key={month.key} className="flex w-[92px] flex-col items-center px-1 pt-2 sm:w-[112px]">
              <div className="flex h-40 w-full items-end justify-center gap-2">
                <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-[var(--foreground)]">{month.incidents}</span>
                  <span className="w-7 rounded-t-md bg-[var(--primary)]" style={{ height: `${Math.max(5, (month.incidents / maximum) * 78)}%` }} />
                </div>
                <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-[var(--foreground)]">{month.alerts}</span>
                  <span className="w-7 rounded-t-md bg-blue-500" style={{ height: `${Math.max(5, (month.alerts / maximum) * 78)}%` }} />
                </div>
                <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-[var(--foreground)]">{month.feeds}</span>
                  <span className="w-7 rounded-t-md bg-amber-500" style={{ height: `${Math.max(5, (month.feeds / maximum) * 78)}%` }} />
                </div>
              </div>
              <span className="mt-2 min-h-9 text-center text-[10px] leading-4 text-[var(--muted-foreground)]">{month.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--primary)]" />Incident reports</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Alerts issued</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Security Feed items published</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">Monthly totals for incident reports, alerts issued, and Security Feed items published</caption>
          <thead className="bg-[var(--muted)]">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-[10px] font-semibold text-[var(--muted-foreground)]">Month</th>
              <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Incidents</th>
              <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Alerts</th>
              <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold text-[var(--muted-foreground)]">Feed items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.map((month) => (
              <tr key={month.key} className="bg-[var(--card)]">
                <th scope="row" className="px-3 py-2.5 text-[11px] font-medium text-[var(--foreground)]">{month.label}</th>
                <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{month.incidents}</td>
                <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{month.alerts}</td>
                <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--foreground)]">{month.feeds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ReportTypeSummary({
  counts,
}: {
  counts: Record<IncidentType | typeof UNCLASSIFIED_INCIDENT_TYPE, number>;
}) {
  return (
    <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Siren className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Reports received</h2>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Incident reports by type in the selected period</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INCIDENT_TYPES.map(({ value, label }) => (
          <div key={value} className="rounded-lg bg-[var(--muted)] p-3">
            <p className="text-[10px] font-medium text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-2 text-[24px] font-semibold leading-7 tabular-nums text-[var(--foreground)]">
              {counts[value].toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AcknowledgementCard({
  available,
  rate,
  acknowledged,
  targeted,
}: {
  available: boolean;
  rate: number | null;
  acknowledged: number;
  targeted: number;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <CheckCheck className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Alert acknowledgement</h2>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">For alerts requiring a staff response in the selected period</p>
        </div>
      </div>
      <p className="mt-5 text-[30px] font-semibold leading-9 tabular-nums text-[var(--foreground)]">
        {rate === null ? "Not available" : `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`}
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        {available
          ? `${acknowledged.toLocaleString()} of ${targeted.toLocaleString()} acknowledgements received`
          : "Acknowledgement totals are incomplete for this period"}
      </p>
      {rate !== null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, rate)}%` }} />
        </div>
      )}
    </section>
  );
}

export default function ManagementReadinessPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const incidents = useSyncExternalStore(subscribeToIncidentState, getIncidentStateSnapshot, getIncidentStateServerSnapshot);
  const alerts = useSyncExternalStore(subscribeToAlertState, getAlertStateSnapshot, getAlertStateServerSnapshot);
  const feeds = useSyncExternalStore(subscribeToFeedState, getFeedStateSnapshot, getFeedStateServerSnapshot);
  const now = useSyncExternalStore(subscribeToClock, getClientNow, getServerNow);
  const period = PERIOD_OPTIONS.find((option) => option.value === searchParams.get("period")) ?? PERIOD_OPTIONS[0];

  const activity = useMemo(
    () => now === null ? [] : buildMonthlyActivity(incidents, alerts, feeds, now, period.days),
    [alerts, feeds, incidents, now, period.days],
  );
  const incidentTypeCounts = useMemo(() => {
    const cutoff = period.days === null || now === null ? null : now - period.days * 24 * 60 * 60 * 1000;
    const counts: Record<IncidentType | typeof UNCLASSIFIED_INCIDENT_TYPE, number> = {
      SOS: 0,
      "Emergency Report": 0,
      "Incident Report": 0,
      [UNCLASSIFIED_INCIDENT_TYPE]: 0,
    };
    incidents.forEach((incident) => {
      const timestamp = parseIncidentReported(incident.reported);
      if (timestamp === null || (now !== null && timestamp > now) || (cutoff !== null && timestamp < cutoff)) return;
      counts[incidentTypeLabel(incident.incidentType)] += 1;
    });
    return counts;
  }, [incidents, now, period.days]);
  const acknowledgementAlerts = useMemo(() => {
    if (now === null && period.days !== null) return [];
    const cutoff = period.days === null || now === null ? null : now - period.days * 24 * 60 * 60 * 1000;
    return alerts.filter((alert) => {
      const timestamp = eventTimestamp(alert.publishedAt ?? alert.updatedAt);
      return timestamp !== null && (now === null || timestamp <= now) && (cutoff === null || timestamp >= cutoff);
    });
  }, [alerts, now, period.days]);
  const acknowledgement = summarizeAlertAcknowledgement(acknowledgementAlerts);

  function updatePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("period");
    else params.set("period", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <ManagementShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Management User · Organizational readiness</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">Trends & readiness</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
            Follow staff engagement, acknowledgement progress, and incident and alert activity over time.
          </p>
        </div>
        <div className="min-w-[190px]">
          <IceSelect label="Reporting period" icon={CalendarDays} value={period.value} options={PERIOD_OPTIONS} onChange={updatePeriod} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdoptionCard />
        <AcknowledgementCard
          available={acknowledgement.available}
          rate={acknowledgement.completionRate}
          acknowledged={acknowledgement.acknowledged}
          targeted={acknowledgement.targeted}
        />
      </div>

      <ReportTypeSummary counts={incidentTypeCounts} />

      <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident & alert activity</h2>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Monthly incident reports, alerts issued, and Security Feed items published during {period.label.toLowerCase()}.</p>
          </div>
          <Bell className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        </div>
        <ActivityTrend data={activity} />
      </section>
    </ManagementShell>
  );
}
