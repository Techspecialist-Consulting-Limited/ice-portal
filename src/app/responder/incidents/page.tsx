"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileWarning,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { IceSelect, type IceSelectOption } from "@/components/ice-select";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../../incidents/incident-state";
import { IncidentTypeBadge, PriorityBadge, isActiveIncident } from "../../incidents/incident-status";
import { parseIncidentReported } from "../../incidents/incident-reported";
import { ResponderPortalShell } from "../responder-shell";
import { canResponderAccessIncident } from "../responder-access";
import { useCurrentUser } from "../../auth/current-user-provider";

const INCIDENT_PAGE_SIZE = 10;

const PERIOD_OPTIONS: IceSelectOption[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "24h", label: "Last 24 hours" },
];

const REPORT_TYPE_OPTIONS: IceSelectOption[] = [
  { value: "all", label: "All report types" },
  { value: "SOS", label: "SOS" },
  { value: "Emergency Report", label: "Emergency Report" },
  { value: "Incident Report", label: "Incident Report" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ResponderIncidentsPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <ResponderIncidentsPageInner />
    </Suspense>
  );
}

function ResponderIncidentsPageInner() {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  const searchTerm = searchParams.get("search") ?? "";

  const category = searchParams.get("category") ?? "all";
  const location = searchParams.get("location") ?? "all";
  const incidentType = searchParams.get("incidentType") ?? "all";
  const period = searchParams.get("period") ?? "all";

  // Keep pagination in sync with the URL
  const queryString = searchParams.toString();
  const prevQueryStringRef = React.useRef(queryString);
  useEffect(() => {
    if (prevQueryStringRef.current !== queryString) {
      setPage(1);
      prevQueryStringRef.current = queryString;
    }
  }, [queryString]);

  const applyFilters = (next: Partial<Record<string, string>>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();
    router.replace(query ? `/responder/incidents?${query}` : "/responder/incidents");
    setPage(1);
  };

  const incidentList = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...Array.from(new Set(incidentList.map((incident) => incident.category))).sort().map((value) => ({ value, label: value })),
    ],
    [incidentList],
  );
  const locationOptions = useMemo(
    () => [
      { value: "all", label: "All locations" },
      ...Array.from(new Set(incidentList.map((incident) => incident.location))).sort().map((value) => ({ value, label: value })),
    ],
    [incidentList],
  );

  const filteredIncidents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const periodMs = period === "7d" ? 7 * 86400000 : period === "24h" ? 86400000 : period === "30d" ? 30 * 86400000 : null;
    const cutoff = now === null || periodMs === null ? null : now - periodMs;
    return incidentList.filter((incident) => {
      const matchesAssigned = canResponderAccessIncident(incident, currentUser);
      const matchesCategory = category === "all" || incident.category === category;
      const matchesLocation = location === "all" || incident.location === location;
      const matchesIncidentType = incidentType === "all" || incident.incidentType === incidentType;
      const reportedAt = parseIncidentReported(incident.reported);
      const matchesPeriod = cutoff === null || (reportedAt !== null && reportedAt >= cutoff);
      const matchesSearch =
        term.length === 0 ||
        `${incident.title} ${incident.id} ${incident.incidentType ?? ""} ${incident.category} ${incident.location} ${incident.reporter ?? ""} ${incident.department ?? ""}`.toLowerCase().includes(term);

      return matchesAssigned && matchesCategory && matchesLocation && matchesIncidentType && matchesPeriod && matchesSearch;
    });
  }, [category, incidentList, location, now, period, searchTerm, incidentType, currentUser]);

  const pageCount = Math.max(1, Math.ceil(filteredIncidents.length / INCIDENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleIncidents = filteredIncidents.slice((currentPage - 1) * INCIDENT_PAGE_SIZE, currentPage * INCIDENT_PAGE_SIZE);
  const shownFrom = filteredIncidents.length === 0 ? 0 : (currentPage - 1) * INCIDENT_PAGE_SIZE + 1;
  const shownTo = Math.min(currentPage * INCIDENT_PAGE_SIZE, filteredIncidents.length);

  const activeFilterCount = [
    category !== "all",
    location !== "all",
    incidentType !== "all",
    searchTerm.trim().length > 0,
    period !== "all",
  ].filter(Boolean).length;

  const summaryCards = [
    {
      label: "Assigned incidents",
      value: filteredIncidents.length,
      icon: ClipboardList,
      tone: "blue",
      detail: "Assigned to you",
    },
    {
      label: "Active assignments",
      value: filteredIncidents.filter((incident) => isActiveIncident(incident.status)).length,
      icon: Clock3,
      tone: "amber",
      detail: "Requiring action",
    },
    {
      label: "Escalated",
      value: filteredIncidents.filter((incident) => incident.status === "Escalated").length,
      icon: ArrowUpRight,
      tone: "red",
      detail: "Escalated incidents",
    },
    {
      label: "Resolved",
      value: filteredIncidents.filter((incident) => incident.status === "Resolved").length,
      icon: CheckCircle2,
      tone: "green",
      detail: "Recently resolved",
    },
  ];

  const onChangeSearch = (value: string) => {
    applyFilters({ search: value });
  };

  const clearAllFilters = () => {
    setPage(1);
    router.replace("/responder/incidents");
  };

  return (
    <ResponderPortalShell
      activeNav="assigned"
      breadcrumbs={
        <>
          <Link href="/responder/dashboard" className="hover:text-[var(--primary)]">Responder Dashboard</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Assigned Incidents</span>
        </>
      }
      pageTitle="Assigned Incidents"
      titleClassName="text-[32px] leading-[38px]"
      description="Search, filter and manage incidents directly assigned to your responder account."
    >
      {showFilters && (
        <div className="mb-5 grid gap-3 rounded-[16px] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-4">
          <FilterField
            label="Reporting period"
            value={period}
            icon={CalendarDays}
            options={PERIOD_OPTIONS}
            onChange={(value) => applyFilters({ period: value })}
          />
          <FilterField
            label="Category"
            value={category}
            onChange={(value) => applyFilters({ category: value })}
            options={categoryOptions}
            icon={ClipboardList}
          />
          <FilterField
            label="Location"
            value={location}
            onChange={(value) => applyFilters({ location: value })}
            options={locationOptions}
            icon={MapPin}
          />
          <FilterField
            label="Report type"
            value={incidentType}
            onChange={(value) => applyFilters({ incidentType: value })}
            options={REPORT_TYPE_OPTIONS}
            icon={FileWarning}
          />
        </div>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const toneClasses: Record<string, string> = {
            blue: "bg-[#eaf3ff] text-[#1d4ed8]",
            amber: "bg-[#fff4d6] text-[#9a6700]",
            green: "bg-[#eaf7ee] text-[#166534]",
            red: "bg-[#fee2e2] text-[#991b1b]",
            slate: "bg-[#eef2ef] text-[#43584b]",
          };

          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                // KPI cards now reset to show all assigned incidents
                applyFilters({});
              }}
              className="rounded-[16px] border border-[var(--border)] bg-white p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--primary)]"
              aria-label={`${card.label}: ${card.value}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClasses[card.tone] || toneClasses.slate)}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
              </div>
              <div className="mt-4 text-[13px] font-medium text-[var(--muted-foreground)]">{card.label}</div>
              <div className="mt-3 text-[30px] font-semibold leading-none text-[var(--foreground)]">{card.value}</div>
              <div className="mt-2 text-[12px] text-[var(--muted-foreground)]">{card.detail}</div>
            </button>
          );
        })}
      </div>

      <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--foreground)]">Assigned incidents list</h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              {filteredIncidents.length} assigned incidents · Assigned to you · Newest reports first
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                aria-label="Search this assigned-incident list"
                value={searchTerm}
                onChange={(event) => onChangeSearch(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                placeholder="Search assigned incidents..."
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && <span className="rounded-full bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">{activeFilterCount}</span>}
            </button>

            {activeFilterCount > 0 && (
              <button type="button" onClick={clearAllFilters} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)]">
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Reference / incident</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Report type</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Category</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Location</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Priority</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Assigned</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium">Reported</th>
                <th className="border-b border-[var(--border)] px-3 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {visibleIncidents.map((incident) => (
                <tr key={incident.id} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <div className="font-medium text-[var(--foreground)]">{incident.title}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{incident.id}</div>
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <IncidentTypeBadge incidentType={incident.incidentType} />
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{incident.category}</td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{incident.location}</td>
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <PriorityBadge priority={incident.priority} />
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">
                    {incident.assignment?.assignee ?? "Not assigned"}
                  </td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{incident.reported}</td>
                  <td className="border-b border-[var(--border)] px-3 py-3 text-right">
                    <Link
                      href={`/responder/incidents/${encodeURIComponent(incident.id)}${queryString ? `?returnTo=${encodeURIComponent(`/responder/incidents?${queryString}`)}` : ""}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    >
                      Open incident
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleIncidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="border-b border-[var(--border)] px-3 py-10 text-center text-sm text-[var(--muted-foreground)]">
                    {activeFilterCount > 0 ? "No assigned incidents match these filters." : "No incidents are currently assigned to you."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[var(--muted-foreground)]">
          <span>
            Showing {shownFrom}–{shownTo} of {filteredIncidents.length} assigned incidents
          </span>
          <div className="flex items-center gap-1" role="navigation" aria-label="Incident pages">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40">&lt;</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={pageNumber === currentPage ? "page" : undefined} aria-label={`Page ${pageNumber}`} className={cn("flex h-8 min-w-8 items-center justify-center rounded-lg border px-2", pageNumber === currentPage ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground)]")}>{pageNumber}</button>
            ))}
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40">&gt;</button>
          </div>
        </div>
      </section>
    </ResponderPortalShell>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  options: IceSelectOption[];
  onChange?: (value: string) => void;
  icon: typeof MapPin;
}) {
  return (
    <IceSelect
      label={label}
      icon={Icon}
      value={value}
      options={options}
      onChange={(next) => onChange?.(next)}
    />
  );
}
