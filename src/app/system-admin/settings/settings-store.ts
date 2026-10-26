import { recordAdminActivity } from "../activity/activity-store";

export type PortalSettings = {
  organizationName: string;
  portalName: string;
  timeZone: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  notifications: {
    criticalIncidentUpdates: boolean;
    administrativeUpdates: boolean;
  };
};

type SettingsSnapshot = {
  settings: PortalSettings;
  error: string | null;
};

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  organizationName: "Nigerian Sovereign Investment Authority",
  portalName: "ICE 2.0",
  timeZone: "Africa/Lagos",
  dateFormat: "DD/MM/YYYY",
  notifications: {
    criticalIncidentUpdates: true,
    administrativeUpdates: true,
  },
};

const STORAGE_KEY = "ice-portal-system-settings";
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: SettingsSnapshot = {
  settings: DEFAULT_PORTAL_SETTINGS,
  error: null,
};

let snapshot = SERVER_SNAPSHOT;
let initialized = false;

function isPortalSettings(value: unknown): value is PortalSettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PortalSettings>;
  return typeof candidate.organizationName === "string"
    && typeof candidate.portalName === "string"
    && typeof candidate.timeZone === "string"
    && (candidate.dateFormat === "DD/MM/YYYY"
      || candidate.dateFormat === "MM/DD/YYYY"
      || candidate.dateFormat === "YYYY-MM-DD")
    && typeof candidate.notifications === "object"
    && candidate.notifications !== null
    && typeof candidate.notifications.criticalIncidentUpdates === "boolean"
    && typeof candidate.notifications.administrativeUpdates === "boolean";
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
    const parsed: unknown = JSON.parse(stored);
    if (!isPortalSettings(parsed)) {
      snapshot = {
        settings: DEFAULT_PORTAL_SETTINGS,
        error: "Saved settings have an invalid format. Review and save the defaults or contact support.",
      };
      return;
    }
    snapshot = { settings: parsed, error: null };
  } catch (cause) {
    snapshot = {
      settings: DEFAULT_PORTAL_SETTINGS,
      error: cause instanceof Error
        ? `Saved settings could not be loaded: ${cause.message}`
        : "Saved settings could not be loaded.",
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

export function subscribeToPortalSettings(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
}

export function getPortalSettingsSnapshot(): SettingsSnapshot {
  initializeSnapshot();
  return snapshot;
}

export function getPortalSettingsServerSnapshot(): SettingsSnapshot {
  return SERVER_SNAPSHOT;
}

export function savePortalSettings(settings: PortalSettings): string | null {
  const previous = getPortalSettingsSnapshot().settings;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (cause) {
    throw new Error(
      cause instanceof Error
        ? `Settings could not be saved in this browser: ${cause.message}`
        : "Settings could not be saved in this browser.",
    );
  }
  snapshot = { settings, error: null };
  initialized = true;
  notifyListeners();
  const changedAreas = [
    previous.organizationName !== settings.organizationName || previous.portalName !== settings.portalName
      ? "organization profile"
      : null,
    previous.notifications.criticalIncidentUpdates !== settings.notifications.criticalIncidentUpdates
      || previous.notifications.administrativeUpdates !== settings.notifications.administrativeUpdates
      ? "notification preferences"
      : null,
  ].filter((area): area is string => area !== null);
  if (changedAreas.length === 0) return null;
  return recordAdminActivity({
    action: "settings",
    target: "Organization settings",
    summary: `Updated ${changedAreas.join(" and ")}.`,
  });
}
