"use client";

import Link from "next/link";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  MapPin,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { AlertItem } from "@/app/dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "../../alert-state";
import { AlertStatusBadge, formatAlertRate, formatAlertTimestamp } from "../../alert-status";
import { PriorityBadge, ToneBadge } from "../../../incidents/incident-status";
import { IncidentPortalShell } from "../../../incidents/incident-shell";
import {
  alertAggregateRecipientTotals,
  buildAlertRecipients,
  recipientOperationalRank,
  recipientTotals,
  type AlertRecipient,
  type RecipientAcknowledgementStatus,
} from "../../alert-recipients";

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: "all", label: "All acknowledgement statuses" },
  { value: "Acknowledged", label: "Acknowledged" },
  { value: "Outstanding", label: "Outstanding" },
  { value: "Escalated", label: "Escalated cases" },
];

type SortKey = "operational" | "name" | "status";
type SortDir = "asc" | "desc";

const toneTileClasses: Record<"green" | "red" | "amber" | "blue", string> = {
  green: "bg-[var(--primary-soft)] text-[var(--primary)]",
  red: "bg-[#fee2e2] text-[#991b1b]",
  amber: "bg-[#fff4d6] text-[#9a6700]",
  blue: "bg-[#eaf3ff] text-[#1d4ed8]",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  onClick,
  selected,
}: {
  icon: typeof UsersRound;
  tone: "green" | "red" | "amber" | "blue";
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneTileClasses[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        {onClick && <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={2} />}
      </div>
      <div className="mt-3 text-[13px] font-medium text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1.5 text-[30px] font-semibold leading-none tabular-nums text-[var(--foreground)]">{value}</div>
      <div className="mt-2 text-[12px] text-[var(--muted-foreground)]">{hint}</div>
    </>
  );

  const base = "flex flex-col rounded-[16px] border bg-white p-4 shadow-[var(--shadow-soft)]";
  if (!onClick) {
    return <div className={cn(base, "border-[var(--border)]")}>{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        base,
        "text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        selected ? "border-[var(--primary)] bg-[var(--primary-softest)]" : "border-[var(--border)] hover:border-[var(--primary)]",
      )}
    >
      {inner}
    </button>
  );
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
  return <IceSelect label={label} icon={Icon} value={value} options={options} onChange={onChange} />;
}

function AcknowledgementStatusBadge({ status }: { status: RecipientAcknowledgementStatus }) {
  return status === "Acknowledged" ? (
    <ToneBadge label="Acknowledged" tone="success" />
  ) : (
    <ToneBadge label="Outstanding" tone="warning" />
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: Exclude<SortKey, "operational">;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: Exclude<SortKey, "operational">) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? (dir === "asc" ? ", ascending" : ", descending") : ""}`}
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors hover:text-[var(--foreground)]",
          active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3.5 w-3.5", active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")} strokeWidth={2} />
      </button>
    </th>
  );
}

function RecipientSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-[16px] border border-[var(--border)] bg-white" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
    </div>
  );
}

function RecipientNotFound({ alertId }: { alertId: string }) {
  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Not found</span>
        </>
      }
      pageTitle="Alert not found"
      description="The requested alert could not be located."
      actions={
        <Link
          href="/alerts"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          Back to alerts
        </Link>
      }
    >
      <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-[var(--muted-foreground)]">
          No alert matches the reference{" "}
          <span className="font-medium text-[var(--foreground)]">{alertId || "provided"}</span>.
        </p>
      </div>
    </IncidentPortalShell>
  );
}

function AlertContextPanel({ alert, escalated }: { alert: AlertItem; escalated: number }) {
  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--muted-foreground)]">{alert.id}</p>
          <h2 className="mt-1 text-[17px] font-semibold leading-6 text-[var(--foreground)]">{alert.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={alert.priority} />
          <AlertStatusBadge status={alert.status} />
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarClock className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Published</dt>
            <dd className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{formatAlertTimestamp(alert.publishedAt)}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <UsersRound className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Audience</dt>
            <dd className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{alert.audience}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <Building2 className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Location</dt>
            <dd className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{alert.location}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Acknowledgement required</dt>
            <dd className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{alert.acknowledgementRequired ? "Yes" : "No"}</dd>
          </div>
        </div>
      </dl>

      {escalated > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#f1d5d5] bg-[#fff5f5] px-3 py-2 text-[12px] font-medium text-[#991b1b]">
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
          {escalated} escalated acknowledgement {escalated === 1 ? "case" : "cases"} on this alert.
        </p>
      )}
    </section>
  );
}

function RecipientContent() {
  const params = useParams();
  const alertId = String(Array.isArray(params.alertId) ? params.alertId[0] : params.alertId ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  const alert = alertList.find((item) => item.id === alertId) ?? null;

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("operational");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const recipients = useMemo(() => (alert ? buildAlertRecipients(alert) : []), [alert]);
  const totals = useMemo(() => recipientTotals(recipients), [recipients]);
  const aggregateTotals = useMemo(() => (alert ? alertAggregateRecipientTotals(alert) : null), [alert]);

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const department = searchParams.get("department") ?? "all";
  const location = searchParams.get("location") ?? "all";

  const departmentOptions = useMemo(() => {
    return [
      { value: "all", label: "All departments" },
      ...Array.from(new Set(recipients.map((item) => item.department))).sort().map((value) => ({ value, label: value })),
    ];
  }, [recipients]);

  const locationOptions = useMemo(() => {
    return [
      { value: "all", label: "All locations" },
      ...Array.from(new Set(recipients.map((item) => item.location))).sort().map((value) => ({ value, label: value })),
    ];
  }, [recipients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipients.filter((recipient) => {
      if (status === "Acknowledged" && recipient.status !== "Acknowledged") return false;
      if (status === "Outstanding" && recipient.status !== "Outstanding") return false;
      if (status === "Escalated" && !recipient.escalated) return false;
      if (department !== "all" && recipient.department !== department) return false;
      if (location !== "all" && recipient.location !== location) return false;
      if (term.length > 0) {
        const haystack = `${recipient.name} ${recipient.department} ${recipient.location}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [recipients, status, department, location, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "status") {
        const rank = (recipient: AlertRecipient) => (recipient.status === "Outstanding" ? 0 : 1);
        cmp = rank(a) - rank(b) || a.name.localeCompare(b.name);
      } else {
        cmp = recipientOperationalRank(a) - recipientOperationalRank(b) || a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortKey, sortDir]);

  if (!alert) {
    return <RecipientNotFound alertId={alertId} />;
  }

  const basePath = `/alerts/${encodeURIComponent(alert.id)}/acknowledgements`;

  const applyFilters = (next: Record<string, string>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "all") nextParams.delete(key);
      else nextParams.set(key, value);
    });
    const query = nextParams.toString();
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    router.replace(basePath, { scroll: false });
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIndex, startIndex + PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, sorted.length);

  const handleSort = (key: Exclude<SortKey, "operational">) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const activeFilterCount = [
    status !== "all",
    department !== "all",
    location !== "all",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (search.trim().length > 0) chips.push({ key: "search", label: `Search: “${search.trim()}”`, onRemove: () => {
    setSearchInput("");
    applyFilters({ search: "" });
  } });
  if (status !== "all") chips.push({ key: "status", label: `Status: ${status}`, onRemove: () => applyFilters({ status: "all" }) });
  if (department !== "all") chips.push({ key: "department", label: `Department: ${department}`, onRemove: () => applyFilters({ department: "all" }) });
  if (location !== "all") chips.push({ key: "location", label: `Location: ${location}`, onRemove: () => applyFilters({ location: "all" }) });

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
      <span aria-hidden="true">/</span>
      <Link href={`/alerts/${encodeURIComponent(alert.id)}`} className="hover:text-[var(--primary)]">{alert.id}</Link>
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">Acknowledgements</span>
    </>
  );

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={breadcrumbs}
      pageTitle="Recipient acknowledgements"
      titleClassName="text-[32px] leading-[38px]"
      description="Review acknowledgement progress and recipient-level status for this alert."
      actions={
        <Link
          href={`/alerts/${encodeURIComponent(alert.id)}`}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          Back to alert details
        </Link>
      }
    >
      <div className="space-y-4">
        <AlertContextPanel alert={alert} escalated={totals.escalated} />

        {!alert.acknowledgementRequired ? (
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1d4ed8]">
                <Info className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Acknowledgement is not required</h2>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  This alert was published without acknowledgement tracking, so there is no recipient acknowledgement list and no completion rate applies.
                </p>
              </div>
            </div>
          </section>
        ) : recipients.length === 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={UsersRound} tone="blue" label="Target recipients" value={aggregateTotals?.total === null || aggregateTotals?.total === undefined ? "Not available" : String(aggregateTotals.total)} hint="Aggregate alert count" />
              <MetricCard icon={CircleCheck} tone="green" label="Acknowledged" value={aggregateTotals?.acknowledged === null || aggregateTotals?.acknowledged === undefined ? "Not available" : String(aggregateTotals.acknowledged)} hint="Aggregate alert count" />
              <MetricCard icon={AlarmClock} tone="amber" label="Outstanding" value={aggregateTotals?.outstanding === null || aggregateTotals?.outstanding === undefined ? "Not available" : String(aggregateTotals.outstanding)} hint="Aggregate alert count" />
              <MetricCard icon={Activity} tone="green" label="Acknowledgement rate" value={formatAlertRate(aggregateTotals?.rate ?? null)} hint="Calculated from alert totals" />
            </div>
            <section className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1d4ed8]">
                  <Info className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Recipient-level records unavailable</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                    These aggregate acknowledgement counts are recorded on the alert. Recipient identities, individual acknowledgement timestamps, delivery and read states are not recorded here, so individual recipients cannot be displayed or filtered.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={UsersRound}
                tone="blue"
                label="Total recipients"
                value={String(totals.total)}
                hint={`Targeted for ${alert.id}`}
              />
              <MetricCard
                icon={CircleCheck}
                tone="green"
                label="Acknowledged"
                value={String(totals.acknowledged)}
                hint="Recipients with a recorded acknowledgement"
                selected={status === "Acknowledged"}
                onClick={() => applyFilters({ status: status === "Acknowledged" ? "all" : "Acknowledged" })}
              />
              <MetricCard
                icon={AlarmClock}
                tone="amber"
                label="Outstanding"
                value={String(totals.outstanding)}
                hint="Still to acknowledge"
                selected={status === "Outstanding"}
                onClick={() => applyFilters({ status: status === "Outstanding" ? "all" : "Outstanding" })}
              />
              <MetricCard
                icon={Activity}
                tone="green"
                label="Acknowledgement rate"
                value={formatAlertRate(totals.rate)}
                hint={`${totals.acknowledged} of ${totals.total} recipients`}
              />
            </div>

            <div className="grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-4">
              <FilterSelect label="Acknowledgement status" icon={Activity} value={status} options={STATUS_OPTIONS} onChange={(value) => applyFilters({ status: value })} />
              <FilterSelect label="Department" icon={Building2} value={department} options={departmentOptions} onChange={(value) => applyFilters({ department: value })} />
              <FilterSelect label="Location" icon={MapPin} value={location} options={locationOptions} onChange={(value) => applyFilters({ location: value })} />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                  className={cn(
                    "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                    activeFilterCount === 0
                      ? "cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]",
                  )}
                >
                  <X className="h-4 w-4" />
                  Reset filters
                </button>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[12px] font-medium text-[var(--foreground)]">
                    {chip.label}
                    <button type="button" onClick={chip.onRemove} aria-label={`Remove filter ${chip.label}`} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--foreground)]">Recipient acknowledgement</h2>
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    {sorted.length === 0
                      ? "No recipients to show"
                      : `Showing ${showingFrom}\u2013${showingTo} of ${sorted.length} ${sorted.length === 1 ? "recipient" : "recipients"}`}
                  </p>
                </div>

                <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
                  <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <input
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value);
                      applyFilters({ search: event.target.value });
                    }}
                    aria-label="Search recipients"
                    className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                    placeholder="Search recipients..."
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      <SortHeader label="Recipient" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Department</th>
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Location</th>
                      <SortHeader label="Acknowledgement" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Acknowledged at</th>
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Escalation</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageItems.map((recipient) => (
                      <tr key={recipient.id} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          <div className="font-medium">{recipient.name}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{recipient.id}</div>
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{recipient.department}</td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{recipient.location}</td>
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          <AcknowledgementStatusBadge status={recipient.status} />
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">
                          {recipient.acknowledgedAt ? (
                            formatAlertTimestamp(recipient.acknowledgedAt)
                          ) : (
                            <span>Not yet</span>
                          )}
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          {recipient.escalated ? (
                            <ToneBadge label="Escalated" tone="danger" />
                          ) : (
                            <span className="text-[var(--muted-foreground)]">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-[13px] text-[var(--muted-foreground)]">No recipients match your search or filters.</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)] sm:flex-row">
                  <span>
                    Showing {showingFrom}&ndash;{showingTo} of {sorted.length} {sorted.length === 1 ? "recipient" : "recipients"}
                  </span>
                  {totalPages > 1 && (
                    <nav aria-label="Pagination" className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                          currentPage === 1 ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--muted)]",
                        )}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="tabular-nums">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                          currentPage === totalPages ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--muted)]",
                        )}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </nav>
                  )}
                </div>
              )}

              <p className="mt-4 flex items-start gap-2 border-t border-[var(--border)] pt-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                Recipient rows are derived from this alert&rsquo;s recorded acknowledgement totals &mdash; individual responses are not recorded. Delivery and open tracking are not captured, so only acknowledgement status is shown. Figures as of {formatAlertTimestamp(alert.updatedAt)}.
              </p>
            </section>
          </>
        )}
      </div>
    </IncidentPortalShell>
  );
}

export default function RecipientAcknowledgementsPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="alerts"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Recipient acknowledgements</span>}
          pageTitle="Recipient acknowledgements"
        >
          <RecipientSkeleton />
        </IncidentPortalShell>
      }
    >
      <RecipientContent />
    </Suspense>
  );
}
