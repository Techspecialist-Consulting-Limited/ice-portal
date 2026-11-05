import { Suspense } from "react";
import { AssignPageContent } from "./assign-client";

function AssignFallback() {
  return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading assignment…</div>;
}

async function AssignRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <AssignPageContent incidentId={id} />;
}

export default function IncidentAssignPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<AssignFallback />}>
      <AssignRoute params={params} />
    </Suspense>
  );
}
