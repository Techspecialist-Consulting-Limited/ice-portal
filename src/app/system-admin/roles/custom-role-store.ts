import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
} from "../../auth/current-user";
import {
  INITIAL_PORTAL_ACCOUNTS,
  PORTAL_ROLES,
  STAFF_ROLE,
  type PortalAccount,
} from "../users/user-directory";
import { recordAdminActivity, type ActivityType } from "../activity/activity-store";

export const ROLE_PERMISSIONS = [
  { key: "incidents.view", label: "View incidents", area: "Incidents" },
  { key: "incidents.manage", label: "Manage incidents", area: "Incidents" },
  { key: "alerts.view", label: "View alerts", area: "Alerts & advisories" },
  { key: "alerts.manage", label: "Manage alerts", area: "Alerts & advisories" },
  { key: "feed.view", label: "View Security Feed", area: "Security Feed" },
  { key: "feed.manage", label: "Manage Security Feed", area: "Security Feed" },
  { key: "reports.view", label: "View reports and analytics", area: "Reports & analytics" },
  { key: "users.manage", label: "Manage portal users", area: "Portal users" },
  { key: "settings.manage", label: "Manage organization settings", area: "Organization settings" },
] as const;

export type RolePermission = (typeof ROLE_PERMISSIONS)[number]["key"];

export type CustomRole = {
  id: string;
  name: string;
  description: string;
  permissions: RolePermission[];
};

export type CustomRoleSnapshot = {
  roles: CustomRole[];
  accounts: PortalAccount[];
  error: string | null;
};

export const BUILT_IN_ROLE_PERMISSIONS: Record<string, RolePermission[]> = {
  [RISK_ADMINISTRATOR]: [
    "incidents.view", "incidents.manage", "alerts.view", "alerts.manage", "feed.view", "feed.manage", "reports.view",
  ],
  [INCIDENT_RESPONDER]: ["incidents.view", "incidents.manage"],
  [MANAGEMENT_USER]: ["incidents.view", "alerts.view", "feed.view", "reports.view"],
  [SYSTEM_ADMINISTRATOR]: ["users.manage", "settings.manage"],
};

const STORAGE_KEY = "ice-portal-custom-roles";
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: CustomRoleSnapshot = {
  roles: [],
  accounts: INITIAL_PORTAL_ACCOUNTS,
  error: null,
};

let snapshot = SERVER_SNAPSHOT;
let initialized = false;

function isRolePermission(value: unknown): value is RolePermission {
  return ROLE_PERMISSIONS.some((permission) => permission.key === value);
}

function isCustomRole(value: unknown): value is CustomRole {
  if (typeof value !== "object" || value === null) return false;
  const role = value as Partial<CustomRole>;
  return typeof role.id === "string"
    && typeof role.name === "string"
    && typeof role.description === "string"
    && Array.isArray(role.permissions)
    && role.permissions.every(isRolePermission);
}

function isPortalAccount(value: unknown): value is PortalAccount {
  if (typeof value !== "object" || value === null) return false;
  const account = value as Partial<PortalAccount>;
  if (
    typeof account.id !== "string"
    || typeof account.name !== "string"
    || typeof account.email !== "string"
    || typeof account.department !== "string"
    || !(account.dateOfBirth === null || typeof account.dateOfBirth === "string")
    || !(account.bloodGroup === null || typeof account.bloodGroup === "string")
    || !(account.genotype === null || typeof account.genotype === "string")
    || !(account.status === "Active" || account.status === "Suspended")
    || typeof account.role !== "string"
    || typeof account.emergencyContacts !== "object"
    || account.emergencyContacts === null
  ) return false;

  return (["primary", "secondary", "tertiary"] as const).every((contactType) => {
    const contact = account.emergencyContacts?.[contactType];
    return contact === null || (
      typeof contact === "object"
      && typeof contact.name === "string"
      && typeof contact.relationship === "string"
      && typeof contact.phone === "string"
    );
  });
}

function initializeSnapshot(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      snapshot = SERVER_SNAPSHOT;
      return;
    }
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) {
      snapshot = { ...SERVER_SNAPSHOT, error: "Saved custom roles have an invalid format. Role data was not loaded." };
      return;
    }
    const data = value as { roles?: unknown; accounts?: unknown };
    if (
      !Array.isArray(data.roles)
      || !data.roles.every(isCustomRole)
      || (data.accounts !== undefined && (!Array.isArray(data.accounts) || !data.accounts.every(isPortalAccount)))
    ) {
      snapshot = {
        ...SERVER_SNAPSHOT,
        error: "Saved custom roles have an invalid format. Role data was not loaded.",
      };
      return;
    }
    snapshot = {
      roles: data.roles,
      accounts: data.accounts as PortalAccount[] | undefined ?? SERVER_SNAPSHOT.accounts,
      error: null,
    };
  } catch (cause) {
    snapshot = {
      ...SERVER_SNAPSHOT,
      error: cause instanceof Error
        ? `Custom roles could not be loaded: ${cause.message}`
        : "Custom roles could not be loaded.",
    };
  }
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function handleStorageChange(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  initialized = false;
  initializeSnapshot();
  notifyListeners();
}

function persist(next: Omit<CustomRoleSnapshot, "error">): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (cause) {
    throw new Error(
      cause instanceof Error
        ? `Custom role changes could not be saved in this browser: ${cause.message}`
        : "Custom role changes could not be saved in this browser.",
    );
  }
  snapshot = { ...next, error: null };
  initialized = true;
  notifyListeners();
}

function assertLoaded(): CustomRoleSnapshot {
  const current = getCustomRoleSnapshot();
  if (current.error) throw new Error(current.error);
  return current;
}

export function subscribeToCustomRoles(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", handleStorageChange);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
}

export function getCustomRoleSnapshot(): CustomRoleSnapshot {
  initializeSnapshot();
  return snapshot;
}

export function getCustomRoleServerSnapshot(): CustomRoleSnapshot {
  return SERVER_SNAPSHOT;
}

export function saveCustomRole(role: CustomRole): string | null {
  const current = assertLoaded();
  const matchingRole = current.roles.find((item) => item.id === role.id);
  const normalizedName = role.name.trim().toLocaleLowerCase();
  if (!normalizedName || normalizedName.length > 60) throw new Error("Enter a role name between 1 and 60 characters.");
  if (role.description.length > 160) throw new Error("Role descriptions must be 160 characters or fewer.");
  if (BUILT_IN_ROLE_PERMISSIONS[role.name] || normalizedName === STAFF_ROLE.toLocaleLowerCase()) {
    throw new Error("Choose a name that is different from built-in roles and Staff.");
  }
  const duplicateName = current.roles.some((item) =>
    item.id !== role.id && item.name.trim().toLocaleLowerCase() === normalizedName,
  ) || PORTAL_ROLES.some((builtInRole) => builtInRole.toLocaleLowerCase() === normalizedName);
  if (duplicateName) throw new Error("A custom role with this name already exists.");
  if (!matchingRole && current.roles.some((item) => item.id === role.id)) {
    throw new Error("This role could not be saved because its identifier is already in use.");
  }

  const roles = matchingRole
    ? current.roles.map((item) => item.id === role.id ? role : item)
    : [...current.roles, role];
  const accounts = [...current.accounts];
  if (matchingRole && matchingRole.name !== role.name) {
    current.accounts.forEach((account, index) => {
      if (account.role === matchingRole.name) accounts[index] = { ...account, role: role.name };
    });
  }
  persist({ roles, accounts });
  const actionWarning = recordAdminActivity({
    action: "custom_role",
    target: role.name,
    summary: matchingRole ? "Updated custom role definition." : "Created custom role.",
  });
  const assignmentWarnings = matchingRole && matchingRole.name !== role.name
    ? current.accounts
      .filter((account) => account.role === matchingRole.name)
      .map((account) => recordAdminActivity({
        action: "role_changed",
        target: account.name,
        summary: `Custom role renamed: ${matchingRole.name} → ${role.name}.`,
      }))
      .filter((warning): warning is string => warning !== null)
    : [];
  if (actionWarning) return actionWarning;
  if (assignmentWarnings.length > 0) return assignmentWarnings[0];
  return null;
}

export function removeCustomRole(roleId: string): string | null {
  const current = assertLoaded();
  const role = current.roles.find((item) => item.id === roleId);
  if (!role) throw new Error("This custom role no longer exists.");
  if (current.accounts.some((account) => account.role === role.name)) {
    throw new Error("Reassign users before deleting this role.");
  }
  persist({
    roles: current.roles.filter((item) => item.id !== roleId),
    accounts: current.accounts,
  });
  return recordAdminActivity({
    action: "custom_role",
    target: role.name,
    summary: "Deleted custom role.",
  });
}

export function savePortalAccounts(accounts: PortalAccount[]): string | null {
  const current = assertLoaded();
  const availableRoles = new Set([...PORTAL_ROLES, ...current.roles.map((role) => role.name)]);
  if (accounts.some((account) => account.role === STAFF_ROLE ? false : !availableRoles.has(account.role))) {
    throw new Error("Every portal account must have a valid built-in or custom role.");
  }
  const currentStaffIds = new Set(current.accounts.filter((account) => account.role === STAFF_ROLE).map((account) => account.id));
  if (accounts.some((account) => account.role === STAFF_ROLE && !currentStaffIds.has(account.id))
    || [...currentStaffIds].some((id) => !accounts.some((account) => account.id === id && account.role === STAFF_ROLE))) {
    throw new Error("Staff records are managed through the mobile app and cannot be changed here.");
  }
  const lastSystemAdministrator = current.accounts.some((account) => account.role === SYSTEM_ADMINISTRATOR)
    && !accounts.some((account) => account.role === SYSTEM_ADMINISTRATOR);
  if (lastSystemAdministrator) throw new Error("At least one System Administrator account must remain assigned.");
  persist({ roles: current.roles, accounts });

  const events: Array<{ action: ActivityType; target: string; summary: string }> = [];
  accounts.forEach((account) => {
    if (account.role === STAFF_ROLE) return;
    const previous = current.accounts.find((existing) => existing.id === account.id);
    if (!previous) {
      events.push({
        action: "account_added" as const,
        target: account.name,
        summary: `Added portal account with ${account.role} role.`,
      });
      return;
    }
    if (previous.role !== account.role) {
      events.push({
        action: "role_changed",
        target: account.name,
        summary: `Role changed from ${previous.role} to ${account.role}.`,
      });
    }
    if (previous.status !== account.status) {
      events.push({
        action: "account_status",
        target: account.name,
        summary: `Account status changed from ${previous.status} to ${account.status}.`,
      });
    }
  });
  const warnings = events
    .map((event) => recordAdminActivity(event))
    .filter((warning): warning is string => warning !== null);
  return warnings.length > 0 ? warnings[0] : null;
}
