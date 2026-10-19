import { Suspense } from "react";
import { ConvertToAlertContent } from "./convert-client";

function ConvertFallback() {
  return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading conversion…</div>;
}

async function ConvertRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConvertToAlertContent incidentId={id} />;
}

export default function ConvertToAlertPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ConvertFallback />}>
      <ConvertRoute params={params} />
    </Suspense>
  );
}
