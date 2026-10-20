import type { ReactNode } from "react";
import Link from "next/link";
import { RISK_ADMINISTRATOR } from "../../auth/current-user";
import { getSessionUser } from "../../auth/role-access";
import { ResponderPortalShell } from "../../responder/responder-shell";

function AccessDenied() {
  return (
    <ResponderPortalShell
      activeNav="assigned"
      pageTitle="Access denied"
      description="This page is available only to the Risk Administrator."
    >
      <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-[var(--muted-foreground)]">
          Use the assigned incident workspace to view and act on incidents assigned to you.
        </p>
        <Link
          href="/responder/incidents"
          className="mt-4 inline-flex items-center rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-strong)]"
        >
          Back to assigned incidents
        </Link>
      </div>
    </ResponderPortalShell>
  );
}

export default async function IncidentAdministratorLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (user.role === RISK_ADMINISTRATOR) return children;
  return <AccessDenied />;
}
