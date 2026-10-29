"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FilePenLine,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Send,
  Archive,
  SlidersHorizontal,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import type { FeedItem } from "../dashboard/mock-data";
import { feedSources } from "../dashboard/mock-data";
import {
  getFeedStateServerSnapshot,
  getFeedStateSnapshot,
  subscribeToFeedState,
  updateFeedItem,
} from "./feed-state";
import {
  FEED_STATUS_ORDER,
  FeedStatusBadge,
  canEditFeedItem,
  formatFeedTimestamp,
  isDraft,
  isPublished,
  sourceTypeLabel,
} from "./feed-status";
import { ConfirmDialog, Toast } from "../alerts/alert-dialog";
import { IncidentPortalShell } from "../incidents/incident-shell";
import { currentActorLabel } from "../auth/current-user";

const PAGE_SIZE = 6;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...FEED_STATUS_ORDER.map((value) => ({ value, label: value })),
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "Internal", label: "Internal only" },
  { value: "External", label: "External only" },
];

type SortKey = "title" | "category" | "status" | "updated";
type SortDir = "asc" | "desc";
type PendingAction = { item: FeedItem; action: "publish" | "withdraw" };

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

const toneTileClasses: Record<"green" | "red" | "amber" | "slate" | "blue", string> = {
  green: "bg-[var(--primary-soft)] text-[var(--primary)]",
  red: "bg-[#fee2e2] text-[#991b1b]",
  amber: "bg-[#fff4d6] text-[#9a6700]",
  slate: "bg-[#eef2ef] text-[#43584b]",
  blue: "bg-[#eaf3ff] text-[#1d4ed8]",
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
  icon: typeof Newspaper;
  tone: "green" | "red" | "amber" | "slate" | "blue";
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
  icon: typeof Search;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return <IceSelect label={label} icon={Icon} value={value} options={options} onChange={onChange} />;
}

function RowMenuAction({
  label,
  icon: Icon,
  href,
  onSelect,
  danger,
}: {
  label: string;
  icon: typeof Search;
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

function FeedRowMenu({
  item,
  onAction,
  onTogglePin,
}: {
  item: FeedItem;
  onAction: (pending: PendingAction) => void;
  onTogglePin: (item: FeedItem) => void;
}) {
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

  const detailsHref = `/security-feed/${encodeURIComponent(item.id)}`;
  const editable = canEditFeedItem(item.status);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${item.id}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${item.id}`}
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
        >
          <RowMenuAction label="Open item" icon={ArrowRight} href={detailsHref} />
          {editable && <RowMenuAction label="Edit item" icon={Pencil} href={`${detailsHref}/edit`} />}
          {item.status !== "Archived" && (
            <RowMenuAction
              label={item.pinned ? "Unpin item" : "Pin item"}
              icon={item.pinned ? PinOff : Pin}
              onSelect={() => onTogglePin(item)}
            />
          )}
          {isDraft(item.status) && (
            <RowMenuAction label="Publish item" icon={Send} onSelect={() => onAction({ item, action: "publish" })} />
          )}
          {isPublished(item.status) && (
            <RowMenuAction label="Withdraw item" icon={Archive} danger onSelect={() => onAction({ item, action: "withdraw" })} />
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
          "inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:text-[var(--foreground)]",
          active ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3.5 w-3.5", active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")} strokeWidth={2} />
      </button>
    </th>
  );
}

export default function SecurityFeedPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[var(--page-bg)]" />}>
      <SecurityFeedPageInner />
    </Suspense>
  );
}

function SecurityFeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const feedList = useSyncExternalStore(
    subscribeToFeedState,
    getFeedStateSnapshot,
    getFeedStateServerSnapshot,
  );

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "");
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

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const source = searchParams.get("source") ?? "all";
  const sourceType = searchParams.get("sourceType") ?? "all";
  const period = searchParams.get("period") ?? "all";
  const pinned = searchParams.get("pinned") ?? "all";

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
    router.replace(query ? `/security-feed?${query}` : "/security-feed");
    setPage(1);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setPage(1);
    router.replace("/security-feed");
  };

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...Array.from(new Set(feedList.map((item) => item.category))).sort().map((value) => ({ value, label: value })),
    ],
    [feedList],
  );

  const sourceOptions = useMemo(
    () => [
      { value: "all", label: "All sources" },
      ...Array.from(new Set(feedList.map((item) => item.source))).sort().map((value) => ({ value, label: value })),
    ],
    [feedList],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff = periodCutoff(period, now);
    return feedList.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (category !== "all" && item.category !== category) return false;
      if (source !== "all" && item.source !== source) return false;
      if (sourceType !== "all" && item.sourceType !== sourceType) return false;
      if (pinned === "only" && !item.pinned) return false;
      if (cutoff !== null && Date.parse(item.updatedAt) < cutoff) return false;
      if (term.length > 0) {
        const haystack = `${item.title} ${item.id} ${item.category} ${item.source} ${item.summary ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [feedList, now, period, status, category, source, sourceType, pinned, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category);
      else if (sortKey === "status") cmp = FEED_STATUS_ORDER.indexOf(a.status) - FEED_STATUS_ORDER.indexOf(b.status);
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
  // dashboard and act as stable navigation filters.
  const publishedCount = feedList.filter((item) => isPublished(item.status)).length;
  const pinnedCount = feedList.filter((item) => item.pinned).length;
  const draftCount = feedList.filter((item) => isDraft(item.status)).length;
  const externalCount = feedList.filter((item) => item.sourceType === "External").length;

  const activeFilterCount = [
    status !== "all",
    category !== "all",
    source !== "all",
    sourceType !== "all",
    period !== "all",
    pinned === "only",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const runAction = () => {
    if (!pending) return;
    const { item, action } = pending;
    const stamp = formatFeedTimestamp(new Date().toISOString());
    try {
      const updated = updateFeedItem(item.id, (current) => ({
        ...current,
        status: action === "publish" ? "Published" : "Withdrawn",
        publishedAt: action === "publish" ? current.publishedAt ?? new Date().toISOString() : current.publishedAt,
        updatedAt: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            title: action === "publish" ? "Item published" : "Item withdrawn",
            detail:
              action === "publish"
                ? `Published to the Security Feed by ${currentActorLabel()}.`
                : `Withdrawn by ${currentActorLabel()}. Retained for audit history.`,
            time: stamp,
          },
        ],
      }));
      if (!updated) throw new Error("Item could not be updated");
      showToast(action === "publish" ? `${item.id} was published.` : `${item.id} was withdrawn.`, "success");
    } catch {
      showToast("We couldn't update this item. It was left unchanged — please try again.", "error");
    } finally {
      setPending(null);
    }
  };

  const togglePin = (item: FeedItem) => {
    try {
      const updated = updateFeedItem(item.id, (current) => ({
        ...current,
        pinned: !current.pinned,
        updatedAt: new Date().toISOString(),
      }));
      if (!updated) throw new Error("Item could not be updated");
      showToast(updated.pinned ? `${item.id} was pinned.` : `${item.id} was unpinned.`, "success");
    } catch {
      showToast("We couldn't change the pin state. It was left unchanged — please try again.", "error");
    }
  };

  const showingFrom = sorted.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, sorted.length);

  // Source activity is derived from the canonical records: for each approved
  // external source we show how many published items came from it and the most
  // recent published timestamp. No sync schedule or health is implied.
  const externalSourceActivity = feedSources
    .filter((entry) => entry.type === "External")
    .map((entry) => {
      const items = feedList.filter((item) => item.source === entry.name && isPublished(item.status));
      const latest = items
        .map((item) => item.publishedAt ?? item.updatedAt)
        .sort((a, b) => b.localeCompare(a))[0];
      return { ...entry, publishedCount: items.length, latest };
    });

  return (
    <IncidentPortalShell
      activeNav="security-feed"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Security Feed</span>
        </>
      }
      pageTitle="Security Feed"
      description="Manage security updates and approved situational-awareness content."
      actions={
        <Link
          href="/security-feed/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
          Create feed item
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Published items"
          value={publishedCount}
          icon={Newspaper}
          tone="green"
          selected={status === "Published"}
          onClick={() => applyFilters({ status: status === "Published" ? "all" : "Published" })}
        />
        <SummaryCard
          label="Pinned"
          value={pinnedCount}
          icon={Pin}
          tone="green"
          selected={pinned === "only"}
          onClick={() => applyFilters({ pinned: pinned === "only" ? "all" : "only" })}
        />
        <SummaryCard
          label="Drafts"
          value={draftCount}
          icon={FilePenLine}
          tone="slate"
          selected={status === "Draft"}
          onClick={() => applyFilters({ status: status === "Draft" ? "all" : "Draft" })}
        />
        <SummaryCard
          label="External items"
          value={externalCount}
          icon={ExternalLink}
          tone="blue"
          selected={sourceType === "External"}
          onClick={() => applyFilters({ sourceType: sourceType === "External" ? "all" : "External" })}
        />
      </div>

      <div className="mt-4 grid gap-3 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-soft)] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <FilterSelect label="Status" icon={SlidersHorizontal} value={status} options={STATUS_OPTIONS} onChange={(value) => applyFilters({ status: value })} />
        <FilterSelect label="Category" icon={Newspaper} value={category} options={categoryOptions} onChange={(value) => applyFilters({ category: value })} />
        <FilterSelect label="Source" icon={ExternalLink} value={source} options={sourceOptions} onChange={(value) => applyFilters({ source: value })} />
        <FilterSelect label="Source type" icon={ExternalLink} value={sourceType} options={SOURCE_TYPE_OPTIONS} onChange={(value) => applyFilters({ sourceType: value })} />
        <FilterSelect label="Reporting period" icon={SlidersHorizontal} value={period} options={PERIOD_OPTIONS} onChange={(value) => applyFilters({ period: value })} />
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
            <RotateCcw className="h-4 w-4" />
            Reset filters
          </button>
        </div>
      </div>

      <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--foreground)]">All feed items</h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              {sorted.length === 0
                ? "No feed items to show"
                : `Showing ${showingFrom}\u2013${showingTo} of ${sorted.length} ${sorted.length === 1 ? "item" : "items"}`}
              {pinned === "only" ? " · Pinned only" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  applyFilters({ search: event.target.value });
                }}
                aria-label="Search feed items"
                className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                placeholder="Search feed items, categories or sources..."
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] text-[var(--muted-foreground)]">
                <SortHeader label="Feed item" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Category" sortKey="category" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 font-medium">Source</th>
                <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Published / updated" sortKey="updated" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th scope="col" className="border-b border-[var(--border)] px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>

            <tbody>
              {pageItems.map((item) => {
                const detailsHref = `/security-feed/${encodeURIComponent(item.id)}`;
                return (
                  <tr key={item.id} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]">
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <Link href={detailsHref} className="group block max-w-[420px]">
                        <div className="flex items-center gap-1.5">
                          {item.pinned && (
                            <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" strokeWidth={2} aria-label="Pinned" />
                          )}
                          <span className="truncate font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{item.title}</span>
                        </div>
                        {item.summary && (
                          <div className="mt-0.5 line-clamp-1 text-[12px] text-[var(--muted-foreground)]">{item.summary}</div>
                        )}
                        <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{item.id}</div>
                      </Link>
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">{item.category}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[var(--foreground)]">
                        <span>{item.source}</span>
                        {item.sourceType === "External" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-[#eaf3ff] px-1.5 py-0.5 text-[11px] font-medium text-[#1d4ed8]"
                            title={sourceTypeLabel(item.sourceType)}
                          >
                            <ExternalLink className="h-3 w-3" strokeWidth={2} />
                            External
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <FeedStatusBadge status={item.status} />
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted-foreground)]">
                      <div>{formatFeedTimestamp(item.publishedAt ?? item.updatedAt)}</div>
                      {item.publishedAt && item.updatedAt !== item.publishedAt && (
                        <div className="text-[11px]">Updated {formatFeedTimestamp(item.updatedAt)}</div>
                      )}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={detailsHref}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </Link>
                        <FeedRowMenu item={item} onAction={setPending} onTogglePin={togglePin} />
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
            {feedList.length === 0 ? (
              <>
                <p className="text-[13px] text-[var(--muted-foreground)]">No feed items yet.</p>
                <Link
                  href="/security-feed/new"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
                >
                  <Plus className="h-4 w-4" />
                  Create feed item
                </Link>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[var(--muted-foreground)]">No feed items match the current filters.</p>
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
              Showing {showingFrom}&ndash;{showingTo} of {sorted.length} {sorted.length === 1 ? "item" : "items"}
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

      <section className="mt-5 rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Approved external sources</h2>
          <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Read-only. External source connections are managed by the System Administrator; the Risk Administrator curates the content.
          </p>
        </div>
        {externalSourceActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-6 text-center text-[12px] text-[var(--muted-foreground)]">
            No external sources are configured.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {externalSourceActivity.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={2} />
                  <span className="text-[13px] font-medium text-[var(--foreground)]">{entry.name}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                  {entry.publishedCount} published {entry.publishedCount === 1 ? "item" : "items"}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                  {entry.latest ? `Most recent ${formatFeedTimestamp(entry.latest)}` : "No published items yet"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "publish" ? "Publish feed item" : "Withdraw feed item"}
        description={
          pending ? (
            <>
              {pending.action === "publish" ? (
                <>
                  This will publish <span className="font-medium text-[var(--foreground)]">{pending.item.id}</span> to the
                  Security Feed. It becomes visible to staff, and no external notification is sent.
                </>
              ) : (
                <>
                  This will withdraw <span className="font-medium text-[var(--foreground)]">{pending.item.id}</span> from the
                  Security Feed. The item is retained for audit history and can be reviewed later.
                </>
              )}
            </>
          ) : null
        }
        confirmLabel={pending?.action === "publish" ? "Publish item" : "Withdraw item"}
        tone={pending?.action === "withdraw" ? "danger" : "primary"}
        onConfirm={runAction}
        onClose={() => setPending(null)}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </IncidentPortalShell>
  );
}
