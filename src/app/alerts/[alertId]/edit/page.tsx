"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AlertEditor } from "../../alert-editor";
import { IncidentPortalShell } from "../../../incidents/incident-shell";

function EditAlertContent() {
  const params = useParams();
  const alertId = String(Array.isArray(params.alertId) ? params.alertId[0] : params.alertId ?? "");

  return <AlertEditor mode="edit" alertId={alertId} />;
}

export default function EditAlertPage() {
  return (
    <Suspense
      fallback={
        <IncidentPortalShell
          activeNav="alerts"
          breadcrumbs={<span className="font-medium text-[var(--foreground)]">Edit alert</span>}
          pageTitle="Edit alert"
        >
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-[18px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        </IncidentPortalShell>
      }
    >
      <EditAlertContent />
    </Suspense>
  );
}
