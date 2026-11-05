"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleCheck,
  MapPin,
  Pencil,
  ShieldCheck,
  Tag,
  UsersRound,
} from "lucide-react";
import type { AlertItem } from "@/app/dashboard/mock-data";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
  updateAlert,
} from "../alert-state";
import {
  AlertStatusBadge,
  alertAcknowledgementRate,
  alertOutstanding,
  canEditAlert,
  formatAlertRate,
  formatAlertTimestamp,
  isActiveAlert,
} from "../alert-status";
import { ConfirmDialog, Toast } from "../alert-dialog";
import { hasRecordedEscalation } from "../alert-escalations";
import { currentActorLabel } from "../../auth/current-user";
import { PriorityBadge } from "../../incidents/incident-status";
import { IncidentPortalShell } from "../../incidents/incident-shell";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MetaField({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--muted-foreground)]" strokeWidth={1.9} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-[13px] font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

function RelatedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function MetricTile({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
      <p className={cn("mt-1 text-[20px] font-semibold tabular-nums", emphasis ? "text-[#b77909]" : "text-[var(--foreground)]")}>
        {value}
      </p>
    </div>
  );
}

function AlertDetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((index) => (
          <div key={index} className="h-40 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
        ))}
      </div>
    </div>
  );
}

function AlertNotFound({ alertId }: { alertId: string }) {
  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={
        <>
          <Link href="/dashboard" className="hover:text-[var(--primary)]">Home</Link>
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
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" />
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

function AcknowledgementPerformance({ alert }: { alert: AlertItem }) {
  if (alert.status === "Draft") {
    return (
      <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
        This alert has not been published yet. Acknowledgement metrics will appear after publication.
      </p>
    );
  }

  if (!alert.acknowledgementRequired) {
    return <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">Acknowledgement is not required for this alert.</p>;
  }

  const rate = alertAcknowledgementRate(alert);
  const outstanding = alertOutstanding(alert);
  const targeted = alert.acknowledgementTargetCount ?? 0;
  const acknowledged = alert.acknowledgedCount ?? 0;

  if (rate === null || outstanding === null) {
    return (
      <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
        Acknowledgement counts are not available for this alert, so a rate cannot be calculated.
      </p>
    );
  }

  const finalised = !isActiveAlert(alert.status);

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Targeted" value={String(targeted)} />
        <MetricTile label="Acknowledged" value={String(acknowledged)} />
        <MetricTile label="Outstanding" value={String(outstanding)} emphasis={outstanding > 0} />
        <MetricTile label="Rate" value={formatAlertRate(rate)} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-[13px] text-[var(--foreground)]">
          <span>Acknowledgement rate</span>
          <span className="font-medium tabular-nums">{formatAlertRate(rate)}</span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)]"
          role="img"
          aria-label={`Acknowledgement rate ${formatAlertRate(rate)}`}
        >
          <div
            className={cn("h-full rounded-full", outstanding > 0 ? "bg-[#d97706]" : "bg-[var(--primary)]")}
            style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
          {outstanding > 0
            ? `${acknowledged} of ${targeted} targeted recipients have acknowledged; ${outstanding} remain outstanding.`
            : `All ${targeted} targeted recipients have acknowledged.`}
        </p>
      </div>

      {finalised && (
        <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
          This alert is {alert.status.toLowerCase()}, so these acknowledgement figures are final.
        </p>
      )}

    </>
  );
}

function EscalationPanel({ alert }: { alert: AlertItem }) {
  const events = (alert.history ?? []).filter((event) => /escalat/i.test(event.title));
  if (!hasRecordedEscalation(alert)) return null;

  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Escalation history</h2>
        <Link
          href={`/alerts/escalations?alert=${encodeURIComponent(alert.id)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
      <ol className="mt-3 space-y-3">
        {events.map((event, index) => (
          <li key={`${event.title}-${index}`} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--foreground)]">{event.title}</p>
              <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">{event.detail}</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{event.time}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AlertDetailContent() {
  const params = useParams();
  const alertId = String(Array.isArray(params.alertId) ? params.alertId[0] : params.alertId ?? "");

  const alertList = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  const alert = alertList.find((item) => item.id === alertId) ?? null;

  const [pending, setPending] = useState<{ action: "withdraw" | "close" } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (!alert) {
    return <AlertNotFound alertId={alertId} />;
  }

  const active = isActiveAlert(alert.status);
  const history = (alert.history ?? []).filter((event) => !/escalat/i.test(event.title));

  const runAction = () => {
    if (!pending) return;
    const action = pending.action;
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
      setToast({ message: action === "withdraw" ? `${alert.id} was withdrawn.` : `${alert.id} was closed.`, tone: "success" });
    } catch {
      setToast({ message: "We couldn't update the alert. It was left unchanged — please try again.", tone: "error" });
    } finally {
      setPending(null);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <IncidentPortalShell
      activeNav="alerts"
      breadcrumbs={
        <>
          <Link href="/dashboard" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/alerts" className="hover:text-[var(--primary)]">Alerts &amp; Advisories</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">{alert.id}</span>
        </>
      }
      pageTitle={alert.title}
      description={`${alert.id} · ${alert.category}`}
      actions={
        <>
          <Link
            href="/alerts"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to alerts
          </Link>
          {canEditAlert(alert.status) && (
            <Link
              href={`/alerts/${encodeURIComponent(alert.id)}/edit`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
              Update alert
            </Link>
          )}
          {active && (
            <button
              type="button"
              onClick={() => setPending({ action: "withdraw" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e7b7b7] bg-white px-3.5 text-sm font-medium text-[#991b1b] shadow-[var(--shadow-soft)] transition-colors hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c62828]"
            >
              <Ban className="h-[18px] w-[18px]" strokeWidth={2} />
              Withdraw
            </button>
          )}
          {active && (
            <button
              type="button"
              onClick={() => setPending({ action: "close" })}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <CircleCheck className="h-[18px] w-[18px]" strokeWidth={2} />
              Close alert
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <section
            aria-labelledby="alert-overview-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="alert-overview-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Overview</h2>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={alert.priority} />
                <AlertStatusBadge status={alert.status} />
              </div>
            </div>

            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetaField icon={Tag} label="Category" value={alert.category} />
              <MetaField icon={UsersRound} label="Audience" value={alert.audience} />
              <MetaField icon={MapPin} label="Location" value={alert.location} />
              <MetaField icon={ShieldCheck} label="Shareability" value={alert.shareability} />
            </div>
          </section>

          <section
            aria-labelledby="alert-message-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 id="alert-message-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Message</h2>
            <p className="mt-2 max-w-[72ch] text-[14px] leading-6 text-[var(--foreground)]">
              {alert.summary?.trim() ? alert.summary : "No message was recorded for this alert."}
            </p>
          </section>

          <section
            aria-labelledby="alert-performance-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="alert-performance-heading" className="text-[15px] font-semibold text-[var(--foreground)]">
                Acknowledgement performance
              </h2>
            </div>
            <AcknowledgementPerformance alert={alert} />
          </section>

          <section
            aria-labelledby="alert-history-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="alert-history-heading" className="text-[15px] font-semibold text-[var(--foreground)]">History</h2>
              {history.length > 0 && (
                <span className="text-[12px] text-[var(--muted-foreground)]">
                  {history.length} {history.length === 1 ? "event" : "events"}
                </span>
              )}
            </div>

            {history.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {history.map((event, index) => (
                  <li key={`${event.title}-${index}`} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--foreground)]">{event.title}</p>
                      <p className="text-[12px] leading-5 text-[var(--muted-foreground)]">{event.detail}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{event.time}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                No lifecycle events have been recorded for this alert. Changes you make in this session will appear here.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section
            aria-labelledby="alert-publication-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 id="alert-publication-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Publication</h2>
            <dl className="mt-3 divide-y divide-[var(--border)]">
              <RelatedRow label="Reference" value={alert.id} />
              <RelatedRow label="Published" value={formatAlertTimestamp(alert.publishedAt)} />
              <RelatedRow label="Last updated" value={formatAlertTimestamp(alert.updatedAt)} />
              <RelatedRow label="Published by" value={alert.publishedBy ?? alert.createdBy ?? "Not available"} />
              {alert.sourceIncidentId && (
                <div className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="text-[13px] text-[var(--muted-foreground)]">Source incident</dt>
                  <dd className="text-right text-[13px] font-medium">
                    <Link
                      href={`/incidents/${encodeURIComponent(alert.sourceIncidentId)}`}
                      className="text-[var(--primary)] hover:text-[var(--primary-strong)]"
                    >
                      {alert.sourceIncidentId}
                    </Link>
                  </dd>
                </div>
              )}
              {alert.createdBy && alert.createdBy !== alert.publishedBy && (
                <RelatedRow label="Created by" value={alert.createdBy} />
              )}
            </dl>
          </section>

          <section
            aria-labelledby="alert-audience-heading"
            className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 id="alert-audience-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Audience &amp; delivery</h2>
            <dl className="mt-3 divide-y divide-[var(--border)]">
              <RelatedRow label="Audience" value={alert.audience} />
              <RelatedRow label="Location" value={alert.location} />
              <RelatedRow label="Shareability" value={alert.shareability} />
              <RelatedRow
                label="Acknowledgement required"
                value={alert.acknowledgementRequired ? "Yes" : "No"}
              />
            </dl>
          </section>

          <EscalationPanel alert={alert} />
        </aside>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "withdraw" ? "Withdraw alert" : "Close alert"}
        description={
          pending ? (
            <>
              {pending.action === "withdraw" ? (
                <>
                  This will mark <span className="font-medium text-[var(--foreground)]">{alert.id}</span> as withdrawn and remove
                  it from the active alerts. Previously published notices cannot be recalled from recipients.
                </>
              ) : (
                <>
                  This will close <span className="font-medium text-[var(--foreground)]">{alert.id}</span> and move it out of the
                  active alerts. This is a meaningful lifecycle change.
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

export default function AlertDetailPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="alerts"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Alert details</span>}
          pageTitle="Alert details"
        >
          <AlertDetailSkeleton />
        </IncidentPortalShell>
      }
    >
      <AlertDetailContent />
    </Suspense>
  );
}
