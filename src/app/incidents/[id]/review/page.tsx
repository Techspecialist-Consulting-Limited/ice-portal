import { Suspense } from "react";
import { ReviewPageContent, type ReviewDecision } from "./review-client";

type ReviewSearchParams = { decision?: string | string[] };

function ReviewFallback() {
  return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading review…</div>;
}

async function ReviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ReviewSearchParams>;
}) {
  const { id } = await params;
  const { decision } = await searchParams;
  const value = Array.isArray(decision) ? decision[0] : decision;
  const requestedDecision: ReviewDecision | null =
    value === "verify" ? "verify" : value === "reject" ? "reject" : null;

  return <ReviewPageContent incidentId={id} requestedDecision={requestedDecision} />;
}

export default function IncidentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ReviewSearchParams>;
}) {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <ReviewRoute params={params} searchParams={searchParams} />
    </Suspense>
  );
}
