"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import {
  Check,
  CircleCheck,
  Copy,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { IceSelect } from "@/components/ice-select";
import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
} from "../../auth/current-user";
import { SystemAdminShell } from "../system-admin-shell";
import {
  BUILT_IN_ROLE_PERMISSIONS,
  getCustomRoleServerSnapshot,
  getCustomRoleSnapshot,
  ROLE_PERMISSIONS,
  removeCustomRole,
  saveCustomRole,
  subscribeToCustomRoles,
  type CustomRole,
  type RolePermission,
} from "../roles/custom-role-store";

const BUILT_IN_ROLES = [
  { name: RISK_ADMINISTRATOR, description: "Coordinates operational incident, alert, and Security Feed workflows." },
  { name: INCIDENT_RESPONDER, description: "Works on assigned incidents and response follow-up." },
  { name: MANAGEMENT_USER, description: "Reviews organization-wide analytics, trends, and executive reports." },
  { name: SYSTEM_ADMINISTRATOR, description: "Oversees portal accounts, role assignments, and organization settings." },
] as const;

type RoleEditor = { type: "create" } | { type: "edit"; role: CustomRole } | null;
type DeleteTarget = CustomRole | null;

function RolePermissionList({ permissions }: { permissions: RolePermission[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Access included</p>
      {permissions.length === 0 ? (
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-[10px] text-[var(--muted-foreground)]">No access selected</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {permissions.map((permission) => {
            const definition = ROLE_PERMISSIONS.find((item) => item.key === permission);
            return definition ? (
              <li key={permission} className="rounded-md bg-[var(--muted)] px-2 py-1 text-[10px] text-[var(--foreground)]">{definition.label}</li>
            ) : null;
          })}
        </ul>
      )}
    </div>
  );
}

export default function SystemAdminCustomRolesPage() {
  const snapshot = useSyncExternalStore(
    subscribeToCustomRoles,
    getCustomRoleSnapshot,
    getCustomRoleServerSnapshot,
  );
  const [editor, setEditor] = useState<RoleEditor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [copyFrom, setCopyFrom] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activityWarning, setActivityWarning] = useState("");
  const [success, setSuccess] = useState("");

  const assignedCount = (roleName: string) => snapshot.accounts.filter((account) => account.role === roleName).length;

  function startCreate() {
    setName("");
    setDescription("");
    setPermissions([]);
    setCopyFrom("");
    setFormError("");
    setActivityWarning("");
    setSuccess("");
    setEditor({ type: "create" });
  }

  function startEdit(role: CustomRole) {
    setName(role.name);
    setDescription(role.description);
    setPermissions(role.permissions);
    setFormError("");
    setActivityWarning("");
    setSuccess("");
    setEditor({ type: "edit", role });
  }

  function closeEditor() {
    setEditor(null);
    setFormError("");
  }

  function applyPreset(roleName: string) {
    setCopyFrom(roleName);
    const builtInPermissions = BUILT_IN_ROLE_PERMISSIONS[roleName];
    if (builtInPermissions) {
      setPermissions([...builtInPermissions]);
      setDescription(`Based on ${roleName}.`);
      return;
    }
    const customRole = snapshot.roles.find((role) => role.name === roleName);
    if (customRole) {
      setPermissions([...customRole.permissions]);
      setDescription(`Based on ${customRole.name}.`);
    }
  }

  function togglePermission(permission: RolePermission, checked: boolean) {
    setPermissions((current) => checked
      ? [...current, permission]
      : current.filter((item) => item !== permission));
  }

  function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const role: CustomRole = {
      id: editor.type === "edit" ? editor.role.id : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description.trim(),
      permissions: ROLE_PERMISSIONS.map(({ key }) => key).filter((key) => permissions.includes(key)),
    };
    try {
      const warning = saveCustomRole(role);
      setSuccess(`The ${role.name} role was ${editor.type === "create" ? "created" : "updated"}.`);
      setActivityWarning(warning ?? "");
      setEditor(null);
      setFormError("");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "The role could not be saved.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const warning = removeCustomRole(deleteTarget.id);
      setSuccess(`The ${deleteTarget.name} role was deleted.`);
      setActivityWarning(warning ?? "");
      setActionError("");
      setDeleteTarget(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The role could not be deleted.");
      setDeleteTarget(null);
    }
  }

  return (
    <SystemAdminShell>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Access configuration</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">Custom roles</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
            Create reusable access profiles for portal users.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--primary-strong)] sm:self-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create custom role
        </button>
      </div>

      {snapshot.error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{snapshot.error}</p>}
      {actionError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{actionError}</p>}
      {activityWarning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">{activityWarning}</p>}
      {success && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
          <CircleCheck className="h-4 w-4" aria-hidden="true" />
          {success}
        </p>
      )}

      <section aria-labelledby="built-in-roles-heading" className="mb-5">
        <div className="mb-3">
          <h2 id="built-in-roles-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Built-in roles</h2>
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Core portal roles are fixed and cannot be edited or removed.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {BUILT_IN_ROLES.map(({ name: roleName, description: roleDescription }) => (
            <article key={roleName} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[12px] font-semibold text-[var(--foreground)]">{roleName}</h3>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)]">{roleDescription}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1 text-[9px] font-medium text-[var(--muted-foreground)]">
                  <LockKeyhole className="h-3 w-3" aria-hidden="true" /> Built-in
                </span>
              </div>
              <RolePermissionList permissions={BUILT_IN_ROLE_PERMISSIONS[roleName]} />
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
                {assignedCount(roleName)} assigned accounts
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="custom-roles-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="custom-roles-heading" className="text-[15px] font-semibold text-[var(--foreground)]">Custom roles</h2>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Roles created for specific portal responsibilities.</p>
          </div>
          <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-medium tabular-nums text-[var(--muted-foreground)]">{snapshot.roles.length}</span>
        </div>
        {snapshot.roles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" aria-hidden="true" />
            <h3 className="mt-3 text-[13px] font-semibold text-[var(--foreground)]">No custom roles yet</h3>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">Create a role with only the access needed for its responsibilities.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {snapshot.roles.map((role) => (
              <article key={role.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[12px] font-semibold text-[var(--foreground)]">{role.name}</h3>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)]">{role.description || "No description provided."}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[9px] font-medium text-[var(--primary)]">Custom</span>
                </div>
                <RolePermissionList permissions={role.permissions} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <p className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                    <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {assignedCount(role.name)} assigned accounts
                  </p>
                  <div className="flex gap-1.5">
                    {assignedCount(role.name) > 0 && (
                      <Link href={`/system-admin/users?role=${encodeURIComponent(role.name)}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]">
                        View users
                      </Link>
                    )}
                    <button type="button" onClick={() => startEdit(role)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                    </button>
                    <button type="button" onClick={() => { setActionError(""); setDeleteTarget(role); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-[10px] font-medium text-red-700 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="custom-role-dialog-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="custom-role-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">{editor.type === "create" ? "Create custom role" : "Edit custom role"}</h2>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">Name the role and select the portal areas it should cover.</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close dialog" className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <form onSubmit={saveRole} className="space-y-4">
              {editor.type === "create" && (
                <IceSelect
                  label="Start from an existing role (optional)"
                  icon={Copy}
                  value={copyFrom}
                  options={[
                    { value: "", label: "Start with no permissions" },
                    ...BUILT_IN_ROLES.map(({ name: roleName }) => ({ value: roleName, label: `Copy ${roleName}` })),
                    ...snapshot.roles.map((role) => ({ value: role.name, label: `Copy ${role.name}` })),
                  ]}
                  onChange={applyPreset}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">Role name</span>
                  <input autoFocus required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">Description</span>
                  <input maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold text-[var(--foreground)]">Portal access</legend>
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                  {Array.from(new Set(ROLE_PERMISSIONS.map(({ area }) => area))).map((area) => (
                    <div key={area} className="p-3">
                      <h3 className="mb-2 text-[10px] font-semibold text-[var(--muted-foreground)]">{area}</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ROLE_PERMISSIONS.filter((item) => item.area === area).map((item) => (
                          <label key={item.key} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[10px] text-[var(--foreground)] hover:bg-[var(--muted)]">
                            <input
                              type="checkbox"
                              checked={permissions.includes(item.key)}
                              onChange={(event) => togglePermission(item.key, event.target.checked)}
                              className="h-4 w-4 accent-[var(--primary)]"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

              {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{formError}</p>}
              <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-[10px] leading-4 text-[var(--muted-foreground)]">
                These selections describe the role only. They do not grant or change live system permissions.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeEditor} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">Cancel</button>
                <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--primary-strong)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save role
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-role-title" className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 id="delete-role-title" className="text-[15px] font-semibold text-[var(--foreground)]">Delete {deleteTarget.name}?</h2>
                <p className="mt-1.5 text-[11px] leading-5 text-[var(--muted-foreground)]">
                  A custom role can only be deleted when no portal users are assigned to it.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)]">Cancel</button>
              <button type="button" onClick={confirmDelete} className="min-h-10 rounded-lg bg-red-700 px-4 text-[11px] font-semibold text-white hover:bg-red-800">Confirm delete</button>
            </div>
          </section>
        </div>
      )}
    </SystemAdminShell>
  );
}
