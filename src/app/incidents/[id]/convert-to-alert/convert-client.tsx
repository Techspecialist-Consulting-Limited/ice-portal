"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../../incident-state";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "@/app/alerts/alert-state";
import {
  ALERT_CONFIGURED_CATEGORIES,
  ALERT_OTHER_CATEGORY,
  MAX_ALERT_SUMMARY,
  emptyAlertDraftFields,
  writeAlertDraft,
} from "@/app/alerts/alert-draft";
import { IncidentPortalShell } from "../../incident-shell";

export function ConvertToAlertContent({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const prepared = useRef(false);
  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const alerts = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );

  const incident = incidents.find((item) => item.id === incidentId) ?? null;
  const sourceAlert = alerts.find((alert) => alert.sourceIncidentId === incidentId);

  useEffect(() => {
    if (!incident || incident.status === "Rejected" || sourceAlert || prepared.current) return;

    prepared.current = true;
    const categoryIsConfigured = ALERT_CONFIGURED_CATEGORIES.includes(incident.category);
    writeAlertDraft({
      key: "create",
      mode: "create",
      sourceIncidentId: incident.id,
      notificationType: incident.priority === "Critical" ? "Alert" : "Advisory",
      fields: {
        ...emptyAlertDraftFields(),
        title: incident.title,
        summary: (incident.description ?? "").trim().slice(0, MAX_ALERT_SUMMARY),
        category: categoryIsConfigured ? incident.category : ALERT_OTHER_CATEGORY,
        customCategory: categoryIsConfigured ? "" : incident.category,
        priority: incident.priority,
        location: incident.location,
      },
    });
    router.replace("/alerts/new");
  }, [incident, router, sourceAlert]);

  const returnLink = (
    <Link
      href={incident ? `/incidents/${encodeURIComponent(incident.id)}` : "/incidents"}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
    >
      Back to incident
    </Link>
  );

  if (!incident) {
    return (
      <IncidentPortalShell
        breadcrumbs={<Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>}
        pageTitle="Incident not found"
        description="The requested incident could not be located."
        actions={returnLink}
      >
        <p className="rounded-[18px] border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted-foreground)]">
          No incident matches this reference.
        </p>
      </IncidentPortalShell>
    );
  }

  if (sourceAlert) {
    const alertHref =
      sourceAlert.status === "Draft"
        ? `/alerts/${encodeURIComponent(sourceAlert.id)}/edit`
        : `/alerts/${encodeURIComponent(sourceAlert.id)}`;
    return (
      <IncidentPortalShell
        breadcrumbs={<Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="hover:text-[var(--primary)]">{incident.id}</Link>}
        pageTitle="Alert already linked"
        description="An alert has already been prepared from this incident."
        actions={returnLink}
      >
        <Link
          href={alertHref}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)]"
        >
          Open {sourceAlert.id}
        </Link>
      </IncidentPortalShell>
    );
  }

  if (incident.status === "Rejected") {
    return (
      <IncidentPortalShell
        breadcrumbs={<Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="hover:text-[var(--primary)]">{incident.id}</Link>}
        pageTitle="Alert unavailable"
        description="A rejected report cannot be converted to an alert."
        actions={returnLink}
      >
        <p className="rounded-[18px] border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted-foreground)]">
          Rejected reports are not shared with staff as alerts.
        </p>
      </IncidentPortalShell>
    );
  }

  return (
    <IncidentPortalShell
      breadcrumbs={<Link href={`/incidents/${encodeURIComponent(incident.id)}`} className="hover:text-[var(--primary)]">{incident.id}</Link>}
      pageTitle="Preparing alert"
      description="Opening the alert form with incident details for review."
      actions={returnLink}
    >
      <p role="status" className="rounded-[18px] border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted-foreground)]">
        The alert has not been published.
      </p>
    </IncidentPortalShell>
  );
}
