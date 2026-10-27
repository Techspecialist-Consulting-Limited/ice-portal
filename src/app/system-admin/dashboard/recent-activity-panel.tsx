"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import Link from "next/link";
import {
  getActivityServerSnapshot,
  getActivitySnapshot,
  subscribeToActivity,
  ACTIVITY_TYPES,
} from "../activity/activity-store";

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getEventColor(action: string): string {
  switch (action) {
    case "account_added":
      return "bg-emerald-100 text-emerald-700";
    case "account_status":
      return "bg-amber-100 text-amber-700";
    case "role_changed":
    case "custom_role":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function RecentActivityPanel() {
  const snapshot = useSyncExternalStore(
    subscribeToActivity,
    getActivitySnapshot,
    getActivityServerSnapshot,
  );
  const recentActivities = snapshot.events.slice(0, 5);

  return (
    <section aria-labelledby="recent-activity-heading" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          <div>
            <h2 id="recent-activity-heading" className="text-[17px] font-semibold text-[var(--foreground)]">
              Recent activity
            </h2>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Latest changes to users, roles and access.
            </p>
          </div>
        </div>
        <Link
          href="/system-admin/activity"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          View all
        </Link>
      </div>

      {recentActivities.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Clock className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" aria-hidden="true" />
          <h3 className="mt-3 text-[13px] font-semibold text-[var(--foreground)]">No activity recorded yet</h3>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
            Administrative changes made after this feature was enabled will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {recentActivities.map((event) => (
            <li key={event.id} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getEventColor(event.action)}`}>
                {getInitials(event.actor)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[var(--foreground)]">
                  {ACTIVITY_TYPES.find(({ value }) => value === event.action)?.label ?? event.action}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] truncate">{event.summary}</p>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                {formatRelativeTime(event.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
