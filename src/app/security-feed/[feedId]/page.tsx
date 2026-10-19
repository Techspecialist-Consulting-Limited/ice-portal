"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarClock,
  Newspaper,
  Pencil,
  Pin,
  PinOff,
  Send,
  ShieldCheck,
  Tag,
  UsersRound,
} from "lucide-react";
import { getFeedStateServerSnapshot, getFeedStateSnapshot, subscribeToFeedState, updateFeedItem } from "../feed-state";
import {
  FeedPriorityBadge,
  FeedStatusBadge,
  canEditFeedItem,
  formatFeedTimestamp,
  isDraft,
  isPublished,
  sourceTypeLabel,
} from "../feed-status";
import { ConfirmDialog, Toast } from "../../alerts/alert-dialog";
import { IncidentPortalShell } from "../../incidents/incident-shell";
import { currentActorLabel } from "../../auth/current-user";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MetaField({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

function FeedDetailSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-32 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
      ))}
    </div>
  );
}

function FeedNotFound({ feedId }: { feedId: string }) {
  return (
    <IncidentPortalShell
      activeNav="security-feed"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/security-feed" className="hover:text-[var(--primary)]">Security Feed</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Not found</span>
        </>
      }
      pageTitle="Feed item not found"
      description="The requested feed item could not be located."
      actions={
        <Link
          href="/security-feed"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to security feed
        </Link>
      }
    >
      <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-[var(--muted-foreground)]">
          No feed item matches the reference <span className="font-medium text-[var(--foreground)]">{feedId || "provided"}</span>.
        </p>
      </div>
    </IncidentPortalShell>
  );
}

function FeedDetailContent() {
  const params = useParams();
  const feedId = String(Array.isArray(params.feedId) ? params.feedId[0] : params.feedId ?? "");

  const feedList = useSyncExternalStore(
    subscribeToFeedState,
    getFeedStateSnapshot,
    getFeedStateServerSnapshot,
  );
  const item = feedList.find((entry) => entry.id === feedId) ?? null;

  const [pending, setPending] = useState<{ action: "publish" | "withdraw" } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (!item) {
    return <FeedNotFound feedId={feedId} />;
  }

  const detailsHref = `/security-feed/${encodeURIComponent(item.id)}`;
  const editable = canEditFeedItem(item.status);
  const publishable = isDraft(item.status);
  const withdrawable = isPublished(item.status);

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ message, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  const togglePin = () => {
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

  const runAction = () => {
    if (!pending) return;
    const action = pending.action;
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

  return (
    <IncidentPortalShell
      activeNav="security-feed"
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/security-feed" className="hover:text-[var(--primary)]">Security Feed</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">{item.id}</span>
        </>
      }
      pageTitle={item.title}
      description={`${item.id} · ${item.category}`}
      actions={
        <>
          <Link
            href="/security-feed"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to security feed
          </Link>
          {editable && (
            <Link
              href={`${detailsHref}/edit`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
              Edit
            </Link>
          )}
          {item.status !== "Archived" && (
            <button
              type="button"
              onClick={togglePin}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {item.pinned ? <PinOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Pin className="h-[18px] w-[18px]" strokeWidth={2} />}
              {item.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {publishable && (
            <button
              type="button"
              onClick={() => setPending({ action: "publish" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <Send className="h-[18px] w-[18px]" strokeWidth={2} />
              Publish
            </button>
          )}
          {withdrawable && (
            <button
              type="button"
              onClick={() => setPending({ action: "withdraw" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e7b7b7] bg-white px-3.5 text-sm font-medium text-[#991b1b] shadow-[var(--shadow-soft)] transition-colors hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c62828]"
            >
              <Archive className="h-[18px] w-[18px]" strokeWidth={2} />
              Withdraw
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Newspaper className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {item.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                      <Pin className="h-3 w-3" strokeWidth={2} />
                      Pinned
                    </span>
                  )}
                  <h2 className="text-[16px] font-semibold leading-6 text-[var(--foreground)]">{item.title}</h2>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{item.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.source}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FeedPriorityBadge priority={item.priority} />
              <FeedStatusBadge status={item.status} />
            </div>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaField icon={Tag} label="Category" value={item.category} />
            <MetaField icon={Building2} label="Source" value={item.source} />
            <MetaField icon={ShieldCheck} label="Source type" value={sourceTypeLabel(item.sourceType)} />
            <MetaField icon={UsersRound} label="Audience" value={item.audience ?? "Not set"} />
            <MetaField icon={ShieldCheck} label="Shareability" value={item.shareability ?? "Not set"} />
            <MetaField icon={CalendarClock} label="Published" value={formatFeedTimestamp(item.publishedAt)} />
          </div>
        </section>

        <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Content</h2>
          {item.summary && (
            <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--muted-foreground)]">{item.summary}</p>
          )}
          <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-[var(--foreground)]">
            {item.content ?? item.summary ?? "No content was recorded for this feed item."}
          </p>

          <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaField icon={CalendarClock} label="Last updated" value={formatFeedTimestamp(item.updatedAt)} />
            <MetaField icon={Pin} label="Pinned" value={item.pinned ? "Yes" : "No"} />
            <MetaField icon={Building2} label="Published by" value={item.publishedBy ?? item.createdBy ?? "Not available"} />
          </div>
        </section>

        {item.history && item.history.length > 0 && (
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">History</h2>
            <ol className="mt-3 space-y-3">
              {item.history.map((event, index) => (
                <li key={`${event.title}-${index}`} className="flex gap-2.5">
                  <span aria-hidden="true" className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", "bg-[var(--primary)]")} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--foreground)]">{event.title}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{event.detail}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{event.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "publish" ? "Publish feed item" : "Withdraw feed item"}
        description={
          pending ? (
            <>
              {pending.action === "publish" ? (
                <>
                  This will publish <span className="font-medium text-[var(--foreground)]">{item.id}</span> to the Security
                  Feed. It becomes visible to staff, and no external notification is sent.
                </>
              ) : (
                <>
                  This will withdraw <span className="font-medium text-[var(--foreground)]">{item.id}</span> from the Security
                  Feed. The item is retained for audit history and can be reviewed later.
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

export default function SecurityFeedDetailPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="security-feed"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Feed item</span>}
          pageTitle="Feed item"
        >
          <FeedDetailSkeleton />
        </IncidentPortalShell>
      }
    >
      <FeedDetailContent />
    </Suspense>
  );
}
