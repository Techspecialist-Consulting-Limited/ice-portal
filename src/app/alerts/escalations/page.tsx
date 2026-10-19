"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Hash,
  Info,
  ListFilter,
  RadioTower,
  Search,
  Send,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import type { AlertItem, AlertPriority } from "@/app/dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "../alert-state";
import { formatAlertTimestamp } from "../alert-status";
import { PriorityBadge, ToneBadge } from "../../incidents/incident-status";
import { IncidentPortalShell } from "../../incidents/incident-shell";
import {
  buildAlertEscalations,
  escalationGroup,
  escalationStatusTone,
  escalationTotals,
  type AlertEscalation,
  type EscalationGroup,
  type EscalationStatus,
} from "../alert-escalations";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: EscalationGroup; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All priorities" },
  { value: "Critical", label: "Critical" },
  { value: "Advisory", label: "Advisory" },
  { value: "Informational", label: "Informational" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const PRIORITY_RANK: Record<AlertPriority, number> = { Critical: 0, Advisory: 1, Informational: 2 };

type SortKey = "triggered" | "alert" | "priority" | "status";
type SortDir = "asc" | "desc";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Resolve "now" on the client only (after mount) so the prerender never depends
// on an unstable value; the default period is "all" (no cutoff).
function periodCutoff(period: string, now: number | null): number | null {
  if (now === null || period === "all") return null;
  if (period === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (period === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

const toneTileClasses: Record<"green" | "red" | "amber" | "blue", string> = {
  green: "bg-[var(--primary-soft)] text-[var(--primary)]",
  red: "bg-[#fee2e2] text-[#991b1b]",
  amber: "bg-[#fff4d6] text-[#9a6700]",
  blue: "bg-[#eaf3ff] text-[#1d4ed8]",
};

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  onClick,
  selected,
}: {
  icon: typeof Send;
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
  icon: typeof Send;
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

function EscalationStatusBadge({ status }: { status: EscalationStatus }) {
  return <ToneBadge label={status} tone={escalationStatusTone(status)} />;
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
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

function DetailRow({ icon: Icon, label, value }: { icon: typeof Send; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)]">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
        <div className="mt-1 text-[13px] font-medium leading-5 text-[var(--foreground)]">{value}</div>
      </div>
    </div>
  );
}

function EscalationDrawer({
  record,
  alert,
  onClose,
}: {
  record: AlertEscalation | null;
  alert: AlertItem | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!record) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  const alertHref = `/alerts/${encodeURIComponent(record.alertId)}`;
  const acknowledgementsHref = `${alertHref}/acknowledgements`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalation-drawer-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-white shadow-[0_0_40px_rgba(17,24,39,0.18)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--muted-foreground)]">{record.id}</p>
            <h2 id="escalation-drawer-title" className="mt-1 text-[17px] font-semibold leading-6 text-[var(--foreground)]">
              Escalation detail
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close escalation detail"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <EscalationStatusBadge status={record.status} />
            <PriorityBadge priority={record.priority} />
            <ToneBadge label={record.levelLabel} tone="neutral" />
          </div>

          <div className="mt-4 divide-y divide-[var(--border)]">
            <DetailRow
              icon={ListFilter}
              label="Alert"
              value={
                <Link href={alertHref} className="text-[var(--primary)] hover:text-[var(--primary-strong)]">
                  <span className="font-medium text-[var(--foreground)]">{record.alertTitle}</span>
                  <span className="text-[var(--muted-foreground)]"> · {record.alertId}</span>
                </Link>
              }
            />
            <DetailRow icon={RadioTower} label="Channel" value={record.channel} />
            <DetailRow icon={UserRound} label="Target" value={record.target} />
            <DetailRow
              icon={CalendarClock}
              label="Triggered at"
              value={record.triggeredAt ? formatAlertTimestamp(record.triggeredAt) : "Not yet triggered"}
            />
            <DetailRow icon={Info} label="Reason" value={record.reason} />
            {record.failureReason && (
              <DetailRow
                icon={TriangleAlert}
                label="Failure reason"
                value={<span className="text-[#991b1b]">{record.failureReason}</span>}
              />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={alertHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
              View alert
            </Link>
            {(!alert || alert.acknowledgementRequired) && (
              <Link
                href={acknowledgementsHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
                View acknowledgements
              </Link>
            )}
          </div>

          <p className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 text-[12px] leading-5 text-[var(--muted-foreground)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            This record is derived from an explicit escalation event in alert history. Channel and delivery outcome are not recorded in the source data.
          </p>
        </div>
      </div>
    </div>
  );
}

function EscalationSkeleton() {
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

function EscalationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("triggered");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));

  const records = useMemo(() => buildAlertEscalations(alertList), [alertList]);
  const totals = useMemo(() => escalationTotals(records), [records]);

  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "all") as EscalationGroup;
  const level = searchParams.get("level") ?? "all";
  const channel = searchParams.get("channel") ?? "all";
  const priority = searchParams.get("priority") ?? "all";
  const period = searchParams.get("period") ?? "all";
  const alertParam = searchParams.get("alert") ?? "";

  const contextAlert = alertParam ? alertList.find((item) => item.id === alertParam) ?? null : null;
  const contextMissing = alertParam.length > 0 && contextAlert === null;

  const levelOptions = useMemo(() => {
    const levels = Array.from(new Set(records.flatMap((record) => record.level === null ? [] : [record.level]))).sort((a, b) => a - b);
    return [{ value: "all", label: "All levels" }, ...levels.map((value) => ({ value: String(value), label: `Level ${value}` }))];
  }, [records]);

  const channelOptions = useMemo(() => {
    const channels = Array.from(new Set(records.map((record) => record.channel))).sort();
    return [{ value: "all", label: "All channels" }, ...channels.map((value) => ({ value, label: value }))];
  }, [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff = periodCutoff(period, now);
    return records.filter((record) => {
      if (alertParam && record.alertId !== alertParam) return false;
      if (status !== "all" && escalationGroup(record.status) !== status) return false;
      if (level !== "all" && String(record.level) !== level) return false;
      if (channel !== "all" && record.channel !== channel) return false;
      if (priority !== "all" && record.priority !== priority) return false;
      if (cutoff !== null) {
        if (!record.triggeredAt) return false;
        if (Date.parse(record.triggeredAt) < cutoff) return false;
      }
      if (term.length > 0) {
        const haystack = `${record.alertId} ${record.alertTitle} ${record.target} ${record.reason} ${record.id}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [records, alertParam, status, level, channel, priority, period, now, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "alert") cmp = a.alertId.localeCompare(b.alertId);
      else if (sortKey === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sortKey === "status") {
        cmp = escalationStatusToneRank(a.status) - escalationStatusToneRank(b.status) || a.alertId.localeCompare(b.alertId);
      } else {
        cmp = (a.triggeredAt ?? "").localeCompare(b.triggeredAt ?? "") || a.id.localeCompare(b.id);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortKey, sortDir]);

  const basePath = "/alerts/escalations";

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

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "triggered" ? "desc" : "asc");
    }
    setPage(1);
  };

  const activeFilterCount = [
    status !== "all",
    level !== "all",
    channel !== "all",
    priority !== "all",
    period !== "all",
    alertParam.length > 0,
    search.trim().length > 0,
  ].filter(Boolean).length;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (search.trim().length > 0) {
    chips.push({
      key: "search",
      label: `Search: “${search.trim()}”`,
      onRemove: () => {
        setSearchInput("");
        applyFilters({ search: "" });
      },
    });
  }
  if (alertParam) chips.push({ key: "alert", label: `Alert: ${alertParam}`, onRemove: () => applyFilters({ alert: "" }) });
  if (status !== "all") chips.push({ key: "status", label: `Stage: ${STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}`, onRemove: () => applyFilters({ status: "all" }) });
  if (level !== "all") chips.push({ key: "level", label: `Level: ${level}`, onRemove: () => applyFilters({ level: "all" }) });
  if (channel !== "all") chips.push({ key: "channel", label: `Channel: ${channel}`, onRemove: () => applyFilters({ channel: "all" }) });
  if (priority !== "all") chips.push({ key: "priority", label: `Priority: ${priority}`, onRemove: () => applyFilters({ priority: "all" }) });
  if (period !== "all") chips.push({ key: "period", label: `Period: ${PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period}`, onRemove: () => applyFilters({ period: "all" }) });

  const selected = selectedId ? records.find((record) => record.id === selectedId) ?? null : null;
  const selectedAlert = selected ? alertList.find((item) => item.id === selected.alertId) ?? null : null;

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
      <span aria-hidden="true">/</span>
      {contextAlert && (
        <>
          <Link href={`/alerts/${encodeURIComponent(contextAlert.id)}`} className="hover:text-[var(--primary)]">{contextAlert.id}</Link>
          <span aria-hidden="true">/</span>
        </>
      )}
      <span className="font-medium text-[var(--foreground)]">Escalation history</span>
    </>
  );

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={breadcrumbs}
      pageTitle="Alert escalation history"
      titleClassName="text-[32px] leading-[38px]"
      description="Review escalation events recorded in alert history. Unrecorded delivery details are not inferred."
      actions={
        <Link
          href={contextAlert ? `/alerts/${encodeURIComponent(contextAlert.id)}` : "/alerts"}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          {contextAlert ? "Back to alert details" : "Back to alerts"}
        </Link>
      }
    >
      <div className="space-y-4">
        {contextAlert && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--primary-softest)] p-4 shadow-[var(--shadow-soft)]">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--muted-foreground)]">Filtered to alert</p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--foreground)]">
                {contextAlert.id} · {contextAlert.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => applyFilters({ alert: "" })}
              className="text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              Show all escalations
            </button>
          </section>
        )}

        {contextMissing ? (
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1d4ed8]">
                <Info className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Alert not found</h2>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  No alert matches the reference{" "}
                  <span className="font-medium text-[var(--foreground)]">{alertParam}</span>.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
                >
                  Show all escalations
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={ClipboardList}
                tone="blue"
                label="Total escalations"
                value={String(totals.total)}
                hint="Records across all alerts"
                selected={status === "all" && alertParam.length === 0}
                onClick={() => applyFilters({ status: "all", alert: "" })}
              />
              <MetricCard
                icon={AlarmClock}
                tone="amber"
                label="In progress"
                value={String(totals.inProgress)}
                hint="Recorded, unresolved escalation events"
                selected={status === "in_progress"}
                onClick={() => applyFilters({ status: status === "in_progress" ? "all" : "in_progress" })}
              />
              <MetricCard
                icon={Send}
                tone="green"
                label="Delivered"
                value={String(totals.delivered)}
                hint="Delivery outcomes recorded in the event data"
                selected={status === "delivered"}
                onClick={() => applyFilters({ status: status === "delivered" ? "all" : "delivered" })}
              />
              <MetricCard
                icon={TriangleAlert}
                tone="red"
                label="Failed"
                value={String(totals.failed)}
                hint="Failures recorded in the event data"
                selected={status === "failed"}
                onClick={() => applyFilters({ status: status === "failed" ? "all" : "failed" })}
              />
            </div>

            <div className="grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <FilterSelect label="Stage" icon={AlarmClock} value={status} options={STATUS_OPTIONS} onChange={(value) => applyFilters({ status: value })} />
              <FilterSelect label="Level" icon={Hash} value={level} options={levelOptions} onChange={(value) => applyFilters({ level: value })} />
              <FilterSelect label="Channel" icon={RadioTower} value={channel} options={channelOptions} onChange={(value) => applyFilters({ channel: value })} />
              <FilterSelect label="Priority" icon={TriangleAlert} value={priority} options={PRIORITY_OPTIONS} onChange={(value) => applyFilters({ priority: value })} />
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
                  <h2 className="text-[18px] font-semibold text-[var(--foreground)]">Escalation records</h2>
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    {sorted.length === 0
                      ? "No escalation records to show"
                      : `Showing ${showingFrom}\u2013${showingTo} of ${sorted.length} ${sorted.length === 1 ? "record" : "records"}`}
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
                    aria-label="Search escalation records"
                    className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                    placeholder="Search by alert, target or reason..."
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      <SortHeader label="Triggered" sortKey="triggered" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Alert" sortKey="alert" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Priority" sortKey="priority" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Level</th>
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Reason</th>
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Target</th>
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Channel</th>
                      <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <th scope="col" className="border-b border-[var(--border)] px-3 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pageItems.map((record) => (
                      <tr key={record.id} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          {record.triggeredAt ? (
                            <div>
                              <div className="font-medium">{formatAlertTimestamp(record.triggeredAt)}</div>
                              <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{record.id}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-[var(--muted-foreground)]">Not yet triggered</div>
                              <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{record.id}</div>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          <Link href={`/alerts/${encodeURIComponent(record.alertId)}`} className="group block max-w-[280px]">
                            <div className="truncate font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{record.alertTitle}</div>
                            <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{record.alertId}</div>
                          </Link>
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          <PriorityBadge priority={record.priority} />
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{record.levelLabel}</td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">
                          <span className="block max-w-[240px] truncate" title={record.reason}>{record.reason}</span>
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{record.target}</td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{record.channel}</td>
                        <td className="border-b border-[var(--border)] px-3 py-3">
                          <EscalationStatusBadge status={record.status} />
                        </td>
                        <td className="border-b border-[var(--border)] px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedId(record.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                          >
                            View details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-[13px] text-[var(--muted-foreground)]">
                    {records.length === 0
                      ? "There are no escalation records. No alert currently requires or has an escalation."
                      : "No escalation records match your search or filters."}
                  </p>
                  {records.length > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-2 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 text-[12px] text-[var(--muted-foreground)] sm:flex-row">
                  <span>
                    Showing {showingFrom}&ndash;{showingTo} of {sorted.length} {sorted.length === 1 ? "record" : "records"}
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
                Only events explicitly recorded in alert history are listed. Level, target, channel, and delivery outcome remain unavailable unless the source record contains them.
              </p>
            </section>
          </>
        )}
      </div>

      <EscalationDrawer record={selected} alert={selectedAlert} onClose={() => setSelectedId(null)} />
    </IncidentPortalShell>
  );
}

// A stable rank for sorting by status stage (pending → triggered → delivered → failed).
function escalationStatusToneRank(status: EscalationStatus): number {
  switch (status) {
    case "Not Required":
      return 0;
    case "Waiting":
      return 1;
    case "Eligible":
      return 2;
    case "Triggered":
      return 3;
    case "Delivered":
      return 4;
    case "Acknowledged":
      return 5;
    case "Completed":
      return 6;
    case "Failed":
      return 7;
    default:
      return 8;
  }
}

export default function AlertEscalationHistoryPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="alerts"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Escalation history</span>}
          pageTitle="Alert escalation history"
        >
          <EscalationSkeleton />
        </IncidentPortalShell>
      }
    >
      <EscalationContent />
    </Suspense>
  );
}
