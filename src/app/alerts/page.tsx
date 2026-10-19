"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpDown,
  Ban,
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Download,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";
import type { AlertItem, AlertPriority } from "../dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
  updateAlert,
} from "./alert-state";
import {
  ALERT_STATUS_ORDER,
  AlertStatusBadge,
  alertAcknowledgementRate,
  alertOutstanding,
  canEditAlert,
  formatAlertRate,
  formatAlertTimestamp,
  isActiveAlert,
  isAwaitingAcknowledgement,
} from "./alert-status";
import {
  countActiveAlerts,
  countActiveCriticalAlerts,
  countAlertsAwaitingAcknowledgement,
  countEscalatedAlerts,
} from "./alert-metrics";
import { currentActorLabel } from "../auth/current-user";
import { hasRecordedEscalation } from "./alert-escalations";
import { ConfirmDialog, Toast } from "./alert-dialog";
import { PriorityBadge } from "../incidents/incident-status";
import { IncidentPortalShell } from "../incidents/incident-shell";

const PAGE_SIZE = 6;

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "Critical", label: "Critical" },
  { value: "Advisory", label: "Advisory" },
  { value: "Informational", label: "Informational" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const PRIORITY_RANK: Record<AlertPriority, number> = { Critical: 0, Advisory: 1, Informational: 2 };

type SortKey = "title" | "priority" | "status" | "updated";
type SortDir = "asc" | "desc";
type PendingAction = { alert: AlertItem; action: "withdraw" | "close" };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Resolve "now" on the client only (after mount) so the prerender never depends
// on an unstable value; the default period is "all" (no cutoff).
function periodCutoff(period: string, now: number | null): number | null {
  if (now === null || period === "all") return null;
  const DAY = 24 * 60 * 60 * 1000;
  if (period === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (period === "7d") return now - 7 * DAY;
  if (period === "30d") return now - 30 * DAY;
  return null;
}

const toneTileClasses: Record<"green" | "red" | "amber" | "slate", string> = {
  green: "bg-[var(--primary-soft)] text-[var(--primary)]",
  red: "bg-[#fee2e2] text-[#991b1b]",
  amber: "bg-[#fff4d6] text-[#9a6700]",
  slate: "bg-[#eef2ef] text-[#43584b]",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof BellRing;
  tone: "green" | "red" | "amber" | "slate";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3 rounded-[16px] border bg-white p-4 text-left shadow-[var(--shadow-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        selected ? "border-[var(--primary)] bg-[var(--primary-softest)]" : "border-[var(--border)] hover:border-[var(--primary)]",
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneTileClasses[tone])}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[26px] font-semibold leading-none text-[var(--foreground)]">{value}</span>
        <span className="mt-1 block text-[13px] font-medium text-[var(--muted-foreground)]">{label}</span>
      </span>
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

function RowMenuAction({
  label,
  icon: Icon,
  href,
  onSelect,
  danger,
}: {
  label: string;
  icon: typeof MapPin;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
}) {
  const classes = cn(
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:bg-[var(--muted)]",
    danger ? "text-[#991b1b] hover:bg-[#fff1f2]" : "text-[var(--foreground)] hover:bg-[var(--muted)]",
  );
  if (href) {
    return (
      <Link role="menuitem" href={href} className={classes}>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onSelect} className={classes}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
      {label}
    </button>
  );
}

function AlertRowMenu({ alert, onAction }: { alert: AlertItem; onAction: (pending: PendingAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const active = isActiveAlert(alert.status);
  const detailsHref = `/alerts/${encodeURIComponent(alert.id)}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${alert.id}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${alert.id}`}
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
        >
          <RowMenuAction label="View alert" icon={ArrowRight} href={detailsHref} />
          {canEditAlert(alert.status) && (
            <RowMenuAction label="Edit alert" icon={Pencil} href={`${detailsHref}/edit`} />
          )}
          {alert.acknowledgementRequired && (
            <RowMenuAction label="Recipient acknowledgements" icon={UsersRound} href={`${detailsHref}/acknowledgements`} />
          )}
          {(alert.status === "Escalated" || hasRecordedEscalation(alert)) && (
            <RowMenuAction label="Escalation history" icon={AlarmClock} href={`/alerts/escalations?alert=${encodeURIComponent(alert.id)}`} />
          )}
          {active && (
            <RowMenuAction label="Withdraw alert" icon={Ban} onSelect={() => onAction({ alert, action: "withdraw" })} danger />
          )}
          {active && (
            <RowMenuAction label="Close alert" icon={CircleCheck} onSelect={() => onAction({ alert, action: "close" })} />
          )}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
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
          align === "right" && "flex-row-reverse",
          active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3.5 w-3.5", active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")} strokeWidth={2} />
      </button>
    </th>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <AlertsPageInner />
    </Suspense>
  );
}

function AlertsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const search = searchParams.get("search") ?? "";
  const priority = searchParams.get("priority") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const audience = searchParams.get("audience") ?? "all";
  const period = searchParams.get("period") ?? "all";
  const scope = searchParams.get("scope") ?? "all";
  const ack = searchParams.get("ack") ?? "all";

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
    router.replace(query ? `/alerts?${query}` : "/alerts");
    setPage(1);
  };

  const resetFilters = () => {
    setPage(1);
    router.replace("/alerts");
  };

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...Array.from(new Set(alertList.map((item) => item.category))).sort().map((value) => ({ value, label: value })),
    ],
    [alertList],
  );

  const audienceOptions = useMemo(
    () => [
      { value: "all", label: "All audiences" },
      ...Array.from(new Set(alertList.map((item) => item.audience))).sort().map((value) => ({ value, label: value })),
    ],
    [alertList],
  );

  const statusOptions = useMemo(
    () => [{ value: "all", label: "All statuses" }, ...ALERT_STATUS_ORDER.map((value) => ({ value, label: value }))],
    [],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff = periodCutoff(period, now);
    return alertList.filter((alert) => {
      if (scope === "active" && !isActiveAlert(alert.status)) return false;
      if (ack === "outstanding" && !isAwaitingAcknowledgement(alert)) return false;
      if (priority !== "all" && alert.priority !== priority) return false;
      if (status !== "all" && alert.status !== status) return false;
      if (category !== "all" && alert.category !== category) return false;
      if (audience !== "all" && alert.audience !== audience) return false;
      if (cutoff !== null && Date.parse(alert.updatedAt) < cutoff) return false;
      if (term.length > 0) {
        const haystack = `${alert.title} ${alert.id} ${alert.category} ${alert.audience} ${alert.location}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [alertList, now, period, scope, ack, priority, status, category, audience, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sortKey === "status") cmp = ALERT_STATUS_ORDER.indexOf(a.status) - ALERT_STATUS_ORDER.indexOf(b.status);
      else cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated" ? "desc" : "asc");
    }
  };

  // Summary counts come from the whole set (unfiltered) so they match the
  // dashboard KPIs and act as stable navigation filters.
  const activeCount = countActiveAlerts(alertList);
  const criticalCount = countActiveCriticalAlerts(alertList);
  const awaitingCount = countAlertsAwaitingAcknowledgement(alertList);
  const escalatedCount = countEscalatedAlerts(alertList);

  const activeFilterCount = [
    scope === "active",
    ack === "outstanding",
    priority !== "all",
    status !== "all",
    category !== "all",
    audience !== "all",
    period !== "all",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const runAction = () => {
    if (!pending) return;
    const { alert, action } = pending;
    const stamp = formatAlertTimestamp(new Date().toISOString());
    try {
      const updated = updateAlert(alert.id, (current) => ({
        ...current,
        status: action === "withdraw" ? "Withdrawn" : "Closed",
        updatedAt: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            title: action === "withdraw" ? "Alert withdrawn" : "Alert closed",
            detail:
              action === "withdraw"
                ? `Withdrawn by ${currentActorLabel()}. The alert is no longer active. Previously published notices cannot be recalled.`
                : `Closed by ${currentActorLabel()}.`,
            time: stamp,
          },
        ],
      }));
      if (!updated) throw new Error("Alert could not be updated");
      setToast({
        message: action === "withdraw" ? `${alert.id} was withdrawn.` : `${alert.id} was closed.`,
        tone: "success",
      });
    } catch {
      setToast({ message: "We couldn't update the alert. It was left unchanged — please try again.", tone: "error" });
    } finally {
      setPending(null);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }
  };

  const handleExport = () => {
    const rows = sorted.map((alert) => [
      alert.id,
      alert.title,
      alert.category,
      alert.priority,
      alert.status,
      alert.audience,
      alert.acknowledgementRequired
        ? `${alert.acknowledgedCount ?? 0} / ${alert.acknowledgementTargetCount ?? 0}`
        : "Not required",
      formatAlertTimestamp(alert.updatedAt),
    ]);
    const csv = [
      ["Reference", "Alert", "Category", "Priority", "Status", "Audience", "Acknowledgement", "Last updated"],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "alerts-advisories.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const showingFrom = sorted.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, sorted.length);

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Alerts &amp; Advisories</span>
        </>
      }
      pageTitle="Alerts & Advisories"
      description="Create, publish and monitor security communications."
      actions={
        <>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Download className="h-[18px] w-[18px]" strokeWidth={2} />
            Export
          </button>
          <Link
            href="/alerts/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            Create alert
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active alerts"
          value={activeCount}
          icon={BellRing}
          tone="green"
          selected={scope === "active"}
          onClick={() => applyFilters({ scope: scope === "active" ? "all" : "active" })}
        />
        <SummaryCard
          label="Critical"
          value={criticalCount}
          icon={TriangleAlert}
          tone="red"
          selected={priority === "Critical" && scope === "active"}
          onClick={() =>
            applyFilters(
              priority === "Critical" && scope === "active"
                ? { priority: "all", scope: "all" }
                : { priority: "Critical", scope: "active" },
            )
          }
        />
        <SummaryCard
          label="Awaiting acknowledgement"
          value={awaitingCount}
          icon={UsersRound}
          tone="amber"
          selected={ack === "outstanding"}
          onClick={() => applyFilters({ ack: ack === "outstanding" ? "all" : "outstanding" })}
        />
        <SummaryCard
          label="Escalated"
          value={escalatedCount}
          icon={AlarmClock}
          tone="slate"
          selected={status === "Escalated"}
          onClick={() => applyFilters({ status: status === "Escalated" ? "all" : "Escalated" })}
        />
      </div>

      <div className="mt-4 grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <FilterSelect label="Priority" icon={TriangleAlert} value={priority} options={PRIORITY_OPTIONS} onChange={(value) => applyFilters({ priority: value })} />
        <FilterSelect label="Status" icon={SlidersHorizontal} value={status} options={statusOptions} onChange={(value) => applyFilters({ status: value })} />
        <FilterSelect label="Category" icon={ClipboardList} value={category} options={categoryOptions} onChange={(value) => applyFilters({ category: value })} />
        <FilterSelect label="Audience" icon={UsersRound} value={audience} options={audienceOptions} onChange={(value) => applyFilters({ audience: value })} />
        <FilterSelect label="Reporting period" icon={CalendarClock} value={period} options={PERIOD_OPTIONS} onChange={(value) => applyFilters({ period: value })} />
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

      <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--foreground)]">All alerts</h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              {sorted.length === 0
                ? "No alerts to show"
                : `Showing ${showingFrom}\u2013${showingTo} of ${sorted.length} ${sorted.length === 1 ? "alert" : "alerts"}`}
              {scope === "active" ? " · Active only" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(event) => applyFilters({ search: event.target.value })}
                aria-label="Search alerts"
                className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                placeholder="Search alerts..."
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                <SortHeader label="Alert / reference" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Priority" sortKey="priority" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Category</th>
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Audience</th>
                <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Acknowledgement</th>
                <SortHeader label="Last updated" sortKey="updated" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>

            <tbody>
              {pageItems.map((alert) => {
                const rate = alertAcknowledgementRate(alert);
                const outstanding = alertOutstanding(alert);
                const detailsHref = `/alerts/${encodeURIComponent(alert.id)}`;
                return (
                  <tr key={alert.id} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <Link href={detailsHref} className="group block max-w-[360px]">
                        <div className="font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{alert.title}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{alert.id}</div>
                      </Link>
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <PriorityBadge priority={alert.priority} />
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{alert.category}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{alert.audience}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <AlertStatusBadge status={alert.status} />
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {!alert.acknowledgementRequired ? (
                        <span className="text-[var(--muted-foreground)]">Not required</span>
                      ) : rate === null ? (
                        <span className="text-[var(--muted-foreground)]">Not available</span>
                      ) : (
                        <div className="min-w-[130px]">
                          <div className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="font-medium tabular-nums text-[var(--foreground)]">
                              {alert.acknowledgedCount ?? 0} / {alert.acknowledgementTargetCount ?? 0}
                            </span>
                            <span className="tabular-nums text-[var(--muted-foreground)]">{formatAlertRate(rate)}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                            <div
                              className={cn("h-full rounded-full", outstanding !== null && outstanding > 0 ? "bg-[#d97706]" : "bg-[var(--primary)]")}
                              style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">
                      {formatAlertTimestamp(alert.updatedAt)}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={detailsHref}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        >
                          View
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                        <AlertRowMenu alert={alert} onAction={setPending} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
            {alertList.length === 0 ? (
              <>
                <p className="text-[13px] text-[var(--muted-foreground)]">No alerts yet.</p>
                <Link
                  href="/alerts/new"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
                >
                  <Plus className="h-4 w-4" />
                  Create alert
                </Link>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[var(--muted-foreground)]">No alerts match these filters.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
                >
                  Reset filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)] sm:flex-row">
            <span>
              Showing {showingFrom}&ndash;{showingTo} of {sorted.length} {sorted.length === 1 ? "alert" : "alerts"}
            </span>
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-1.5">
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
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                      pageNumber === currentPage
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]",
                    )}
                  >
                    {pageNumber}
                  </button>
                ))}
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
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "withdraw" ? "Withdraw alert" : "Close alert"}
        description={
          pending ? (
            <>
              {pending.action === "withdraw" ? (
                <>
                  This will mark <span className="font-medium text-[var(--foreground)]">{pending.alert.id}</span> as withdrawn and
                  remove it from the active alerts. Previously published notices cannot be recalled from recipients.
                </>
              ) : (
                <>
                  This will close <span className="font-medium text-[var(--foreground)]">{pending.alert.id}</span> and move it out
                  of the active alerts. This is a meaningful lifecycle change.
                </>
              )}
            </>
          ) : null
        }
        confirmLabel={pending?.action === "withdraw" ? "Withdraw alert" : "Close alert"}
        tone={pending?.action === "withdraw" ? "danger" : "primary"}
        onConfirm={runAction}
        onClose={() => setPending(null)}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
