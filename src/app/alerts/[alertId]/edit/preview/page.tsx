"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AlertPreview } from "../../../alert-preview";
import { IncidentPortalShell } from "../../../../incidents/incident-shell";

function EditAlertPreviewContent() {
  const params = useParams();
  const alertId = String(Array.isArray(params.alertId) ? params.alertId[0] : params.alertId ?? "");

  return <AlertPreview mode="edit" alertId={alertId} />;
}

export default function EditAlertPreviewPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="alerts"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Review alert</span>}
          pageTitle="Review alert"
        >
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        </IncidentPortalShell>
      }
    >
      <EditAlertPreviewContent />
    </Suspense>
  );
}
