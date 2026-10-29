"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDays, Clock3, History, Search } from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import { SystemAdminShell } from "../system-admin-shell";
import {
  ACTIVITY_TYPES,
  getActivityServerSnapshot,
  getActivitySnapshot,
  subscribeToActivity,
} from "./activity-store";

const PAGE_SIZE = 10;
const inputClass = "h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateKey(value: string): string {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function SystemAdminActivityPage() {
  const snapshot = useSyncExternalStore(
    subscribeToActivity,
    getActivitySnapshot,
    getActivityServerSnapshot,
  );
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return snapshot.events.filter((event) => {
      const eventDate = localDateKey(event.timestamp);
      const actionLabel = ACTIVITY_TYPES.find(({ value }) => value === event.action)?.label ?? event.action;
      const matchesSearch = !query
        || event.actor.toLocaleLowerCase().includes(query)
        || event.target.toLocaleLowerCase().includes(query)
        || actionLabel.toLocaleLowerCase().includes(query)
        || event.summary.toLocaleLowerCase().includes(query);
      const matchesType = actionFilter === "all" || event.action === actionFilter;
      const matchesStart = !startDate || eventDate >= startDate;
      const matchesEnd = !endDate || eventDate <= endDate;
      return matchesSearch && matchesType && matchesStart && matchesEnd;
    });
  }, [actionFilter, endDate, search, snapshot.events, startDate]);

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const displayedPage = Math.min(currentPage, pageCount);
  const firstPageNumber = Math.max(1, Math.min(displayedPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPageNumber + index);
  const pageEvents = filteredEvents.slice((displayedPage - 1) * PAGE_SIZE, displayedPage * PAGE_SIZE);

  function resetPageAnd(setter: (value: string) => void, value: string) {
    setter(value);
    setCurrentPage(1);
  }

  return (
    <SystemAdminShell>
      <div className="mb-5">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Administration history</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">Activity log</h1>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
          Review recorded changes to portal accounts, custom roles, and organization settings.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-[11px] leading-4 text-amber-900">
          Sample entries are marked for illustration. Recorded activity is stored in this browser only, is not tamper-proof, and does not include changes made before logging was enabled.
        </p>
      </div>

      {snapshot.error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">
          {snapshot.error}
        </p>
      )}

      <section aria-label="Activity filters" className="mb-4 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Search activity</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => resetPageAnd(setSearch, event.target.value)}
            placeholder="Search actor or summary"
            className={`${inputClass} pl-9`}
          />
        </label>
        <div className="min-w-0">
          <IceSelect
            hideLabel
            label="Filter by activity type"
            value={actionFilter}
            options={[
              { value: "all", label: "All activity types" },
              ...ACTIVITY_TYPES.map(({ value, label }) => ({ value, label })),
            ]}
            onChange={(value) => resetPageAnd(setActionFilter, value)}
          />
        </div>
        <label className="relative">
          <span className="sr-only">From date</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input type="date" aria-label="From date" value={startDate} max={endDate || undefined} onChange={(event) => resetPageAnd(setStartDate, event.target.value)} className={`${inputClass} pl-9`} />
        </label>
        <label className="relative">
          <span className="sr-only">To date</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input type="date" aria-label="To date" value={endDate} min={startDate || undefined} onChange={(event) => resetPageAnd(setEndDate, event.target.value)} className={`${inputClass} pl-9`} />
        </label>
      </section>

      <section aria-label="Administrative activity" className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Recorded activity</h2>
          </div>
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--muted-foreground)]">{filteredEvents.length}</span>
        </div>

        {pageEvents.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <History className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" aria-hidden="true" />
            <h3 className="mt-3 text-[13px] font-semibold text-[var(--foreground)]">{snapshot.events.length === 0 ? "No activity recorded yet" : "No activity matches these filters"}</h3>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              {snapshot.events.length === 0 ? "Administrative changes made after this feature was enabled will appear here." : "Try adjusting the search or date and action filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <caption className="sr-only">Administrative activity recorded in this browser</caption>
                <thead className="bg-[var(--muted)]/60">
                  <tr>
                    {["Date & time", "Administrator", "Action", "Affected account or setting", "Summary"].map((heading) => (
                      <th key={heading} scope="col" className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pageEvents.map((event) => (
                    <tr key={event.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-[10px] text-[var(--muted-foreground)]">{formatTimestamp(event.timestamp)}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-[var(--foreground)]">
                        {event.actor}
                        {event.source === "sample" && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">Sample</span>}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-[var(--foreground)]">{ACTIVITY_TYPES.find(({ value }) => value === event.action)?.label ?? event.action}</td>
                      <td className="px-4 py-3 text-[11px] text-[var(--foreground)]">{event.target}</td>
                      <td className="max-w-[320px] px-4 py-3 text-[11px] leading-4 text-[var(--muted-foreground)]">{event.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Showing {filteredEvents.length === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1}–{Math.min(displayedPage * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length} activities
              </p>
              <nav aria-label="Activity pagination" className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={displayedPage === 1} className="min-h-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40">First</button>
                <button type="button" onClick={() => setCurrentPage(displayedPage - 1)} disabled={displayedPage === 1} className="min-h-8 rounded-md border border-[var(--border)] px-2.5 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                {pageNumbers.map((pageNumber) => (
                  <button key={pageNumber} type="button" onClick={() => setCurrentPage(pageNumber)} aria-current={displayedPage === pageNumber ? "page" : undefined} className={`min-h-8 min-w-8 rounded-md border px-2 text-[10px] ${displayedPage === pageNumber ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}>{pageNumber}</button>
                ))}
                <button type="button" onClick={() => setCurrentPage(displayedPage + 1)} disabled={displayedPage === pageCount} className="min-h-8 rounded-md border border-[var(--border)] px-2.5 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                <button type="button" onClick={() => setCurrentPage(pageCount)} disabled={displayedPage === pageCount} className="min-h-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40">Last</button>
              </nav>
            </div>
          </>
        )}
      </section>
    </SystemAdminShell>
  );
}
