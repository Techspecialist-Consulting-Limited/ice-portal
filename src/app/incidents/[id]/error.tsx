"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IncidentPortalShell } from "../incident-shell";

export default function IncidentDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <IncidentPortalShell
      breadcrumbs={
        <>
          <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Error</span>
        </>
      }
      pageTitle="Could not load incident"
      description={error.message || "Something went wrong while loading this incident."}
    >
      <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-[var(--muted-foreground)]">
          The incident could not be loaded right now. This is usually temporary — try again, or return to the queue.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to incident queue
          </Link>
        </div>
      </div>
    </IncidentPortalShell>
  );
}
