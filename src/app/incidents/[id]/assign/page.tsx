import { Suspense } from "react";
import { AssignPageContent } from "./assign-client";

type AssignSearchParams = { escalate?: string | string[] };

function AssignFallback() {
  return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading assignment…</div>;
}

async function AssignRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AssignSearchParams>;
}) {
  const { id } = await params;
  const { escalate } = await searchParams;
  const escalateMode = (Array.isArray(escalate) ? escalate[0] : escalate) === "1";

  return <AssignPageContent incidentId={id} escalateMode={escalateMode} />;
}

export default function IncidentAssignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AssignSearchParams>;
}) {
  return (
    <Suspense fallback={<AssignFallback />}>
      <AssignRoute params={params} searchParams={searchParams} />
    </Suspense>
  );
}
