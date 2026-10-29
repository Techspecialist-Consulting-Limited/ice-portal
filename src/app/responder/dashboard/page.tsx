"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock3,
  MapPin,
  Tag,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { IncidentItem, IncidentStatus } from "../../dashboard/mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../../incidents/incident-state";
import { canResponderAccessIncident } from "../responder-access";
import {
  INCIDENT_STATUS_ORDER,
  IncidentTypeBadge,
  PriorityBadge,
  incidentStatusBarColor,
  isActiveIncident,
} from "../../incidents/incident-status";
import { ResponderPortalShell } from "../responder-shell";
import { useCurrentUser } from "../../auth/current-user-provider";

// To view this responder dashboard:
// 1. Set SESSION_USER_ID to Abbas Taofeeq's id ("RSP-03") in src/app/auth/current-user.ts
// 2. Ensure the assigneeId matches CURRENT_USER.id in mock-data.ts
// 3. Navigate to /responder/dashboard

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type QueueFilters = {
  category?: string;
  location?: string;
  period?: string;
  incidentType?: string;
};

function queueHref({ category, location, period, incidentType }: QueueFilters) {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (location && location !== "all") params.set("location", location);
  if (period && period !== "all") params.set("period", period);
  if (incidentType && incidentType !== "all") params.set("incidentType", incidentType);
  const query = params.toString();
  return query ? `/responder/incidents?${query}` : "/responder/incidents";
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

function parseReported(value: string): number | null {
  const datePart = value.split("·")[0]?.trim() ?? "";
  const match = datePart.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1])).getTime();
}

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
  return <IceSelect label={label} icon={Icon} value={value} options={options} onChange={onChange} />;
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

export default function ResponderDashboardPage() {
  const currentUser = useCurrentUser();
  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  ) as IncidentItem[];

  const [period, setPeriod] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [incidentType, setIncidentType] = useState("all");
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const categoryOptions = useMemo(
    () => [{ value: "all", label: "All categories" }, ...Array.from(new Set(incidents.map((item: IncidentItem) => item.category))).sort().map((value: string) => ({ value, label: value }))],
    [incidents],
  );
  const locationOptions = useMemo(
    () => [{ value: "all", label: "All locations" }, ...Array.from(new Set(incidents.map((item: IncidentItem) => item.location))).sort().map((value: string) => ({ value, label: value }))],
    [incidents],
  );
  const incidentTypeOptions = [
    { value: "all", label: "All report types" },
    { value: "SOS", label: "SOS" },
    { value: "Emergency Report", label: "Emergency Report" },
    { value: "Incident Report", label: "Incident Report" },
  ];

  const filters: QueueFilters = { category, location, period, incidentType };
  const hasActiveFilters = period !== "all" || category !== "all" || location !== "all" || incidentType !== "all";

  const resetFilters = () => {
    setPeriod("all");
    setCategory("all");
    setLocation("all");
    setIncidentType("all");
  };

  const scopedIncidents = useMemo(() => {
    const cutoff = periodCutoff(period, now);
    return incidents.filter((incident: IncidentItem) => {
      if (!canResponderAccessIncident(incident, currentUser)) return false;
      if (category !== "all" && incident.category !== category) return false;
      if (location !== "all" && incident.location !== location) return false;
      if (incidentType !== "all" && incident.incidentType !== incidentType) return false;
      if (cutoff !== null) {
        const reported = parseReported(incident.reported);
        if (reported === null || reported < cutoff) return false;
      }
      return true;
    });
  }, [incidents, now, period, category, location, incidentType, currentUser]);

  const activeAssignments = useMemo(
    () => scopedIncidents.filter((incident: IncidentItem) => isActiveIncident(incident.status)),
    [scopedIncidents],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    INCIDENT_STATUS_ORDER.forEach((status: string) => {
      counts[status] = 0;
    });
    scopedIncidents.forEach((incident: IncidentItem) => {
      counts[incident.status] = (counts[incident.status] ?? 0) + 1;
    });
    return counts;
  }, [scopedIncidents]);

  const maxStatusCount = Math.max(1, ...INCIDENT_STATUS_ORDER.map((status) => statusCounts[status] ?? 0));

  const newAssignmentsCount = scopedIncidents.length;
  const activeAssignmentsCount = activeAssignments.length;
  const escalatedCount = scopedIncidents.filter((incident) => incident.status === "Escalated").length;
  const resolvedCount = scopedIncidents.filter((incident) => incident.status === "Resolved").length;

  const incidentsRequiringAction = [...activeAssignments]
    .sort((a: IncidentItem, b: IncidentItem) => {
      if (a.status === "Escalated" && b.status !== "Escalated") return -1;
      if (b.status === "Escalated" && a.status !== "Escalated") return 1;
      const aTime = parseReported(a.reported) ?? 0;
      const bTime = parseReported(b.reported) ?? 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const recentlyResolved = scopedIncidents
    .filter((incident: IncidentItem) => incident.status === "Resolved")
    .sort((a: IncidentItem, b: IncidentItem) => {
      const aTime = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
      const bTime = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  return (
    <ResponderPortalShell
      activeNav="dashboard"
      eyebrow="Incident Responder"
      pageTitle="Assigned Incidents"
      description="Monitor assigned incidents, prioritize response work, and track status changes."
      actions={
        <Link
          href={queueHref(filters)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] px-3.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ClipboardList className="h-[18px] w-[18px]" strokeWidth={2} />
          View assigned incidents
        </Link>
      }
    >
      <div className="grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-4">
        <FilterControl label="Reporting period" icon={CalendarDays} value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
        <FilterControl label="Category" icon={ClipboardList} value={category} options={categoryOptions} onChange={setCategory} />
        <FilterControl label="Location" icon={MapPin} value={location} options={locationOptions} onChange={setLocation} />
        <FilterControl label="Report type" icon={Tag} value={incidentType} options={incidentTypeOptions} onChange={setIncidentType} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--muted-foreground)]">
        <span>Filters apply to assigned incidents only.</span>
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
          title="New assignments"
          value={newAssignmentsCount}
          subtitle="Assigned incidents"
          href={queueHref(filters)}
        />
        <KpiCard
          icon={Clock3}
          tone="amber"
          title="Active assignments"
          value={activeAssignmentsCount}
          subtitle="Requiring action"
          href={queueHref(filters)}
        />
        <KpiCard
          icon={ArrowUpRight}
          tone="red"
          title="Escalated"
          value={escalatedCount}
          subtitle="Escalated incidents"
          href={queueHref(filters)}
        />
        <KpiCard
          icon={CircleCheck}
          tone="green"
          title="Resolved"
          value={resolvedCount}
          subtitle="Recently resolved"
          href={queueHref(filters)}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Incidents requiring action</h2>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {activeAssignmentsCount} active {activeAssignmentsCount === 1 ? "assignment" : "assignments"} · prioritized by urgency
              </p>
            </div>
            <PanelLink href={queueHref(filters)}>View all assigned incidents</PanelLink>
          </div>

          {incidentsRequiringAction.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--muted-foreground)]">
              No assigned incidents require action.
            </p>
          ) : (
            <div className="space-y-3">
              {incidentsRequiringAction.map((incident) => (
                <div key={incident.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]">
                      <ClipboardList className="h-[18px] w-[18px] text-[var(--muted-foreground)]" strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={incident.priority} />
                        <IncidentTypeBadge incidentType={incident.incidentType} />
                      </div>
                      <div className="mt-1.5 truncate text-[14px] font-medium text-[var(--foreground)]">{incident.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                        <span>{incident.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{incident.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{incident.location}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                        Assigned: {incident.assignment?.assignee ?? "Not assigned"} · {incident.assignment?.assignedAt ?? "Unknown"}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/responder/incidents/${encodeURIComponent(incident.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    Open incident
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Assigned incidents by status</h2>
            <PanelLink href={queueHref(filters)}>View queue</PanelLink>
          </div>
          <p className="mb-4 text-[12px] text-[var(--muted-foreground)]">
            {scopedIncidents.length} assigned {scopedIncidents.length === 1 ? "incident" : "incidents"} · by current workflow stage
          </p>

          <div className="space-y-3">
            {INCIDENT_STATUS_ORDER.map((status: string) => {
              const count = statusCounts[status] ?? 0;
              if (count === 0) return null;
              const width = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
              return (
                <Link
                  key={status}
                  href={queueHref(filters)}
                  className="block rounded-lg px-1 py-1 transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--foreground)]">
                    <span>{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: incidentStatusBarColor(status as IncidentStatus) }} />
                  </div>
                </Link>
              );
            })}
            {Object.values(statusCounts).every((count) => count === 0) && (
              <p className="text-[13px] text-[var(--muted-foreground)]">No assigned incidents.</p>
            )}
          </div>
        </section>
      </div>

      {recentlyResolved.length > 0 && (
        <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Recently resolved</h2>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Resolved assignments · {recentlyResolved.length} shown
              </p>
            </div>
            <PanelLink href={queueHref(filters)}>View all resolved</PanelLink>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Reference / Incident</th>
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Report type</th>
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Category</th>
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Location</th>
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium">Resolved</th>
                  <th className="border-b border-[var(--border)] px-3 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentlyResolved.map((incident) => (
                  <tr key={incident.id} className="group text-[13px] text-[var(--foreground)] hover:bg-[var(--muted)]">
                    <td className="border-b border-[var(--border)] px-3 py-2.5">
                      <Link href={`/responder/incidents/${encodeURIComponent(incident.id)}`} className="block">
                        <div className="font-medium group-hover:text-[var(--primary)]">{incident.title}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{incident.id}</div>
                      </Link>
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-2.5">
                      <IncidentTypeBadge incidentType={incident.incidentType} />
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">{incident.category}</td>
                    <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">{incident.location}</td>
                    <td className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--muted-foreground)]">
                      {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Unknown"}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-2.5 text-right">
                      <Link
                        href={`/responder/incidents/${encodeURIComponent(incident.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </ResponderPortalShell>
  );
}
