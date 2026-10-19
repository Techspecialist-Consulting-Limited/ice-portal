import { Suspense } from "react";
import { IncidentResolutionContent } from "./resolve-client";

async function IncidentResolutionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentResolutionContent incidentId={id} />;
}

export default function IncidentResolutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--muted-foreground)]">Loading incident resolution…</div>}>
      <IncidentResolutionRoute params={params} />
    </Suspense>
  );
}
