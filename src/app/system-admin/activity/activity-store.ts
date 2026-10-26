import { currentActorLabel } from "../../auth/current-user";

export const ACTIVITY_TYPES = [
  { value: "account_added", label: "Account added" },
  { value: "role_changed", label: "Role changed" },
  { value: "account_status", label: "Account status" },
  { value: "custom_role", label: "Custom role" },
  { value: "settings", label: "Organization settings" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

export type AdminActivityEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: ActivityType;
  target: string;
  summary: string;
  source: "sample" | "recorded";
};

export type ActivitySnapshot = {
  events: AdminActivityEvent[];
  error: string | null;
};

const STORAGE_KEY = "ice-portal-admin-activity";
const MAX_EVENTS = 1000;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: ActivitySnapshot = { events: [], error: null };
const SAMPLE_EVENTS: AdminActivityEvent[] = [
  {
    id: "sample-activity-1",
    timestamp: "2026-10-26T14:42:00.000Z",
    actor: "Sample data",
    action: "account_added",
    target: "Portal user account",
    summary: "Sample: added a portal user with the Incident Responder role.",
    source: "sample",
  },
  {
    id: "sample-activity-2",
    timestamp: "2026-10-26T14:18:00.000Z",
    actor: "Sample data",
    action: "role_changed",
    target: "Portal user account",
    summary: "Sample: changed an account role from Management User to Risk Administrator.",
    source: "sample",
  },
  {
    id: "sample-activity-3",
    timestamp: "2026-10-26T13:56:00.000Z",
    actor: "Sample data",
    action: "account_status",
    target: "Portal user account",
    summary: "Sample: suspended a portal account.",
    source: "sample",
  },
  {
    id: "sample-activity-4",
    timestamp: "2026-10-26T13:27:00.000Z",
    actor: "Sample data",
    action: "custom_role",
    target: "Audit Review",
    summary: "Sample: created a custom role.",
    source: "sample",
  },
  {
    id: "sample-activity-5",
    timestamp: "2026-10-26T12:51:00.000Z",
    actor: "Sample data",
    action: "settings",
    target: "Organization settings",
    summary: "Sample: updated organization notification preferences.",
    source: "sample",
  },
];

let snapshot = SERVER_SNAPSHOT;
let initialized = false;

function isActivityType(value: unknown): value is ActivityType {
  return ACTIVITY_TYPES.some((type) => type.value === value);
}

function isActivityEvent(value: unknown): value is AdminActivityEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<AdminActivityEvent>;
  return typeof event.id === "string"
    && typeof event.timestamp === "string"
    && !Number.isNaN(Date.parse(event.timestamp))
    && typeof event.actor === "string"
    && isActivityType(event.action)
    && typeof event.target === "string"
    && typeof event.summary === "string"
    && (event.source === undefined || event.source === "sample" || event.source === "recorded");
}

function initializeSnapshot(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      snapshot = { events: SAMPLE_EVENTS, error: null };
      return;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isActivityEvent)) {
      snapshot = {
        events: [],
        error: "Saved activity history has an invalid format and could not be loaded.",
      };
      return;
    }
    snapshot = {
      events: parsed.slice(0, MAX_EVENTS).map((event) => ({
        ...event,
        source: event.source ?? "recorded",
      })),
      error: null,
    };
  } catch (cause) {
    snapshot = {
      events: [],
      error: cause instanceof Error
        ? `Activity history could not be loaded: ${cause.message}`
        : "Activity history could not be loaded.",
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

export function subscribeToActivity(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", handleStorageChange);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
}

export function getActivitySnapshot(): ActivitySnapshot {
  initializeSnapshot();
  return snapshot;
}

export function getActivityServerSnapshot(): ActivitySnapshot {
  return SERVER_SNAPSHOT;
}

export function recordAdminActivity(
  event: Omit<AdminActivityEvent, "id" | "timestamp" | "actor" | "source">,
): string | null {
  const current = getActivitySnapshot();
  if (current.error) return current.error;

  const nextEvent: AdminActivityEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    actor: currentActorLabel(),
    source: "recorded",
  };
  const events = [nextEvent, ...current.events.filter((item) => item.source === "recorded")].slice(0, MAX_EVENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (cause) {
    return cause instanceof Error
      ? `The change was saved, but its activity entry could not be recorded: ${cause.message}`
      : "The change was saved, but its activity entry could not be recorded.";
  }
  snapshot = { events, error: null };
  initialized = true;
  notifyListeners();
  return null;
}
