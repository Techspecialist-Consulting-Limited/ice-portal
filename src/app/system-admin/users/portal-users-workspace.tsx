"use client";

import { useMemo, useState, type FormEvent, type ReactNode, useSyncExternalStore } from "react";
import {
  Ban,
  Check,
  CircleCheck,
  Eye,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  X,
} from "lucide-react";
import { useCurrentUser } from "../../auth/current-user-provider";
import {
  getCustomRoleServerSnapshot,
  getCustomRoleSnapshot,
  savePortalAccounts,
  subscribeToCustomRoles,
} from "../roles/custom-role-store";
import {
  DIRECTORY_ROLES,
  STAFF_ROLE,
  type PortalAccount,
  type PortalAccountStatus,
} from "./user-directory";

type AccountForm = Pick<PortalAccount, "role">;
type AccountDialogState =
  | { type: "edit"; account: PortalAccount }
  | { type: "details"; account: PortalAccount }
  | { type: "status"; account: PortalAccount; status: PortalAccountStatus }
  | null;

const EMPTY_FORM: AccountForm = {
  role: "",
};

const PAGE_SIZE = 8;

function formatDateOfBirth(value: string | null): string {
  if (!value) return "Not yet set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Not yet set"
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function ReadOnlyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-1 min-h-10 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2.5 text-[11px] text-[var(--foreground)]">
        {value || "Not yet set"}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: PortalAccountStatus }) {
  const active = status === "Active";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-slate-400"}`} aria-hidden="true" />
      {status}
    </span>
  );
}

function ProfileDetails({ account }: { account: PortalAccount }) {
  return (
    <>
      <section aria-labelledby="profile-details-heading">
        <h3 id="profile-details-heading" className="mb-3 text-[12px] font-semibold text-[var(--foreground)]">Personal &amp; profile details</h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyDetail label="Full name" value={account.name} />
          <ReadOnlyDetail label="Email address" value={account.email} />
          <ReadOnlyDetail label="Date of birth" value={formatDateOfBirth(account.dateOfBirth)} />
          <ReadOnlyDetail label="Department" value={account.department} />
          <ReadOnlyDetail label="Blood group" value={account.bloodGroup ?? "Not yet set"} />
          <ReadOnlyDetail label="Genotype" value={account.genotype ?? "Not yet set"} />
        </dl>
      </section>

      <section aria-labelledby="emergency-contacts-heading" className="border-t border-[var(--border)] pt-4">
        <h3 id="emergency-contacts-heading" className="mb-3 text-[12px] font-semibold text-[var(--foreground)]">Emergency contacts</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {(["primary", "secondary", "tertiary"] as const).map((contactType) => {
            const contact = account.emergencyContacts[contactType];
            return (
              <article key={contactType} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <h4 className="mb-2 text-[10px] font-semibold capitalize text-[var(--muted-foreground)]">{contactType} contact</h4>
                {contact ? (
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-[9px] text-[var(--muted-foreground)]">Name</dt>
                      <dd className="mt-0.5 text-[11px] font-medium text-[var(--foreground)]">{contact.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] text-[var(--muted-foreground)]">Relationship</dt>
                      <dd className="mt-0.5 text-[11px] text-[var(--foreground)]">{contact.relationship}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] text-[var(--muted-foreground)]">Phone</dt>
                      <dd className="mt-0.5 text-[11px] text-[var(--foreground)]">{contact.phone}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="rounded-lg bg-[var(--muted)]/50 px-2.5 py-3 text-[11px] text-[var(--muted-foreground)]">Not yet set</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

export function PortalUsersWorkspace({ initialRole }: { initialRole?: string }) {
  const currentUser = useCurrentUser();
  const roleSnapshot = useSyncExternalStore(
    subscribeToCustomRoles,
    getCustomRoleSnapshot,
    getCustomRoleServerSnapshot,
  );
  const requestedRole = initialRole ?? "all";
  const accounts = roleSnapshot.accounts;
  const roleOptions = [...DIRECTORY_ROLES, ...roleSnapshot.roles.map((role) => role.name)];
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(requestedRole);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialog, setDialog] = useState<AccountDialogState>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [activityWarning, setActivityWarning] = useState("");

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch = !query
        || account.name.toLowerCase().includes(query)
        || account.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesStatus = statusFilter === "all" || account.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, search, statusFilter]);

  const portalAccounts = accounts.filter((account) => account.role !== STAFF_ROLE);
  const activeCount = portalAccounts.filter((account) => account.status === "Active").length;
  const suspendedCount = portalAccounts.length - activeCount;
  const pageCount = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const displayedPage = Math.min(currentPage, pageCount);
  const pageAccounts = filteredAccounts.slice((displayedPage - 1) * PAGE_SIZE, displayedPage * PAGE_SIZE);
  const firstPageNumber = Math.max(1, Math.min(displayedPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPageNumber + index);

  function openEditDialog(account: PortalAccount) {
    if (account.role === STAFF_ROLE) {
      setFeedback("");
      setDialog({ type: "details", account });
      return;
    }
    setForm({ role: account.role });
    setFormError("");
    setActionError("");
    setActivityWarning("");
    setFeedback("");
    setDialog({ type: "edit", account });
  }

  function closeDialog() {
    setDialog(null);
    setFormError("");
  }

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.type !== "edit") return;

    try {
      const warning = savePortalAccounts(accounts.map((account) =>
        account.id === dialog.account.id ? { ...account, role: form.role } : account,
      ));
      setActivityWarning(warning ?? "");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "The account role could not be saved.");
      return;
    }
    setFeedback(`${dialog.account.name}'s access role was updated.`);
    setDialog(null);
    setFormError("");
  }

  function updateAccountStatus() {
    if (dialog?.type !== "status") return;
    try {
      const warning = savePortalAccounts(accounts.map((account) => account.id === dialog.account.id
        ? { ...account, status: dialog.status }
        : account));
      setActionError("");
      setActivityWarning(warning ?? "");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The account status could not be updated.");
      setDialog(null);
      return;
    }
    setFeedback(`${dialog.account.name}'s account is now ${dialog.status.toLowerCase()}.`);
    setCurrentPage(1);
    setDialog(null);
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Account access</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">
            Portal users
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
            View and manage accounts with access to the ICE portal.
          </p>
        </div>
      </div>

      <section aria-label="Portal user totals" className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Portal accounts", value: portalAccounts.length, icon: UsersRound, tone: "primary" },
          { label: "Active", value: activeCount, icon: UserRoundCheck, tone: "success" },
          { label: "Suspended", value: suspendedCount, icon: UserRoundX, tone: "neutral" },
          { label: "Staff records", value: accounts.filter((account) => account.role === STAFF_ROLE).length, icon: UserRound, tone: "primary" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-sm">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone === "primary" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[10px] font-medium text-[var(--muted-foreground)]">{label}</span>
              <span className="mt-0.5 block text-[20px] font-semibold leading-6 tabular-nums text-[var(--foreground)]">{value}</span>
            </span>
          </article>
        ))}
      </section>

      <section aria-label="Portal user directory" className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Account directory</h2>
            <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--muted-foreground)]">
              {filteredAccounts.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <label className="relative block min-w-0 sm:col-span-2 lg:w-[250px]">
              <span className="sr-only">Search by name or email</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name or email"
                className={`${inputClass} pl-9`}
              />
            </label>
            <label className="block">
              <span className="sr-only">Filter by role</span>
              <select value={roleFilter} onChange={(event) => {
                setRoleFilter(event.target.value);
                setCurrentPage(1);
              }} className={`${inputClass} min-w-[180px]`}>
                <option value="all">All roles</option>
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }} className={`${inputClass} min-w-[140px]`}>
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </label>
          </div>
        </div>

        {feedback && (
          <div role="status" className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{feedback}</span>
            <button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message" className="rounded p-0.5 hover:bg-emerald-100">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {actionError && <p role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-700">{actionError}</p>}
        {activityWarning && <p role="status" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">{activityWarning}</p>}

        {filteredAccounts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Search className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" aria-hidden="true" />
            <h3 className="mt-3 text-[13px] font-semibold text-[var(--foreground)]">No accounts found</h3>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Try changing the search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <caption className="sr-only">Portal user directory and account status</caption>
              <thead className="bg-[var(--muted)]">
                <tr>
                  {["User", "Department", "Role", "Status", "Actions"].map((label) => (
                    <th key={label} scope="col" className={`px-4 py-3 text-[10px] font-semibold text-[var(--muted-foreground)] ${label === "Actions" ? "text-right" : ""}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pageAccounts.map((account) => {
                  const isCurrentUser = account.email.toLowerCase() === currentUser.email.toLowerCase()
                    || account.name === currentUser.name;
                  const isStaff = account.role === STAFF_ROLE;
                  return (
                    <tr key={account.id} className="hover:bg-[var(--muted)]/40">
                      <td className="px-4 py-3">
                        <span className="block text-[11px] font-semibold text-[var(--foreground)]">{account.name}</span>
                        <span className="mt-0.5 block text-[10px] text-[var(--muted-foreground)]">{account.email}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[var(--foreground)]">{account.department || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--foreground)]">
                          <ShieldCheck className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
                          {account.role}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={account.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditDialog(account)}
                            aria-label={`View details for ${account.name}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={isCurrentUser || isStaff}
                            onClick={() => {
                              setFeedback("");
                              setDialog({ type: "status", account, status: account.status === "Active" ? "Suspended" : "Active" });
                            }}
                            aria-label={`${account.status === "Active" ? "Suspend" : "Reactivate"} ${account.name}`}
                            title={isCurrentUser
                              ? "You cannot change your own account status."
                              : isStaff
                                ? "Staff account status is managed through the mobile app."
                                : undefined}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {account.status === "Active"
                              ? <><Ban className="h-3.5 w-3.5" aria-hidden="true" />Suspend</>
                              : <><Check className="h-3.5 w-3.5" aria-hidden="true" />Reactivate</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-[var(--muted-foreground)]" aria-live="polite">
            {filteredAccounts.length === 0
              ? "Showing 0 users"
              : `Showing ${(displayedPage - 1) * PAGE_SIZE + 1}–${Math.min(displayedPage * PAGE_SIZE, filteredAccounts.length)} of ${filteredAccounts.length} users`}
          </p>
          <nav aria-label="User directory pagination" className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={displayedPage === 1}
              aria-label="First page"
              className="min-h-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(displayedPage - 1)}
              disabled={displayedPage === 1}
              aria-label="Previous page"
              className="min-h-8 rounded-md border border-[var(--border)] px-2.5 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {firstPageNumber > 1 && (
              <>
                <button type="button" onClick={() => setCurrentPage(1)} className="h-8 min-w-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)]">1</button>
                {firstPageNumber > 2 && <span aria-hidden="true" className="px-1 text-[10px] text-[var(--muted-foreground)]">…</span>}
              </>
            )}
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setCurrentPage(pageNumber)}
                aria-label={`Page ${pageNumber}`}
                aria-current={displayedPage === pageNumber ? "page" : undefined}
                className={`h-8 min-w-8 rounded-md border px-2 text-[10px] ${displayedPage === pageNumber ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
              >
                {pageNumber}
              </button>
            ))}
            {firstPageNumber + pageNumbers.length - 1 < pageCount && (
              <>
                {firstPageNumber + pageNumbers.length < pageCount && <span aria-hidden="true" className="px-1 text-[10px] text-[var(--muted-foreground)]">…</span>}
                <button type="button" onClick={() => setCurrentPage(pageCount)} className="h-8 min-w-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)]">{pageCount}</button>
              </>
            )}
            <button
              type="button"
              onClick={() => setCurrentPage(displayedPage + 1)}
              disabled={displayedPage === pageCount}
              aria-label="Next page"
              className="min-h-8 rounded-md border border-[var(--border)] px-2.5 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(pageCount)}
              disabled={displayedPage === pageCount}
              aria-label="Last page"
              className="min-h-8 rounded-md border border-[var(--border)] px-2 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Last
            </button>
          </nav>
        </div>
      </section>

      {dialog?.type === "edit" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-dialog-title"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="account-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                  User details
                </h2>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">
                  Profile and emergency contact details are read-only. You can update the portal role.
                </p>
              </div>
              <button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveAccount} className="space-y-5">
              <>
                <ProfileDetails account={dialog.account} />

                <section aria-labelledby="access-role-heading" className="border-t border-[var(--border)] pt-4">
                  <h3 id="access-role-heading" className="mb-3 text-[12px] font-semibold text-[var(--foreground)]">Portal access</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Assigned role">
                      <select
                        value={form.role}
                        onChange={(event) => {
                          const role = roleOptions.find((option) => option === event.target.value);
                          if (role && role !== STAFF_ROLE) setForm((current) => ({ ...current, role }));
                        }}
                        className={inputClass}
                      >
                        {roleOptions.filter((role) => role !== STAFF_ROLE).map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </Field>
                    <div>
                      <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">Account status</span>
                      <div className="flex h-10 items-center"><StatusBadge status={dialog.account.status} /></div>
                    </div>
                  </div>
                </section>
              </>
              {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{formError}</p>}
              <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-[10px] leading-4 text-[var(--muted-foreground)]">
                Profile data is read-only here. Saving only changes the role shown in this page.
              </p>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeDialog} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">
                  Cancel
                </button>
                <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--primary-strong)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Save role
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {dialog?.type === "details" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-details-title"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="staff-details-title" className="text-[16px] font-semibold text-[var(--foreground)]">Staff details</h2>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">
                  Profile information is read-only. Staff accounts are managed through the mobile app.
                </p>
              </div>
              <button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5">
              <ProfileDetails account={dialog.account} />
              <section aria-labelledby="staff-access-heading" className="border-t border-[var(--border)] pt-4">
                <h3 id="staff-access-heading" className="mb-3 text-[12px] font-semibold text-[var(--foreground)]">Access type</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)]">Staff</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Mobile app account · No portal role assigned</span>
                </div>
              </section>
              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="button" onClick={closeDialog} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {dialog?.type === "status" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="status-dialog-title"
            aria-describedby="status-dialog-description"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dialog.status === "Suspended" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {dialog.status === "Suspended" ? <Ban className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div>
                <h2 id="status-dialog-title" className="text-[15px] font-semibold text-[var(--foreground)]">
                  {dialog.status === "Suspended" ? "Suspend account?" : "Reactivate account?"}
                </h2>
                <p id="status-dialog-description" className="mt-1.5 text-[11px] leading-5 text-[var(--muted-foreground)]">
                  {dialog.account.name}&apos;s account will be marked {dialog.status.toLowerCase()} in this page only. Sign-in access is not changed.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeDialog} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">
                Cancel
              </button>
              <button type="button" onClick={updateAccountStatus} className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--primary-strong)]">
                Confirm {dialog.status.toLowerCase()}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
