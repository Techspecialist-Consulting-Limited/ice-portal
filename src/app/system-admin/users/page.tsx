import { Suspense } from "react";
import { SystemAdminShell } from "../system-admin-shell";
import { PortalUsersWorkspace } from "./portal-users-workspace";

async function PortalUsersPageContent({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const { role } = await searchParams;
  const initialRole = Array.isArray(role) ? role[0] : role;
  return <PortalUsersWorkspace key={initialRole ?? "all"} initialRole={initialRole} />;
}

export default function SystemAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  return (
    <SystemAdminShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-[var(--muted)]" />}>
        <PortalUsersPageContent searchParams={searchParams} />
      </Suspense>
    </SystemAdminShell>
  );
}
