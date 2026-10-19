"use client";

import { alerts as seedAlerts, type AlertItem } from "@/app/dashboard/mock-data";

// Shared alert store. The Risk Dashboard and the Alerts & Advisories page both
// read from this single source, so a withdraw/close/update here is reflected on
// the dashboard without a reload. Mirrors the incident store pattern.
const STORAGE_KEY = "ice-alert-state-v1";

let cachedState: AlertItem[] | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function subscribeToAlertState(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getAlertStateSnapshot(): AlertItem[] {
  if (cachedState === null) {
    cachedState = readAlertState();
  }
  return cachedState;
}

export function getAlertStateServerSnapshot(): AlertItem[] {
  return seedAlerts;
}

export function readAlertState(): AlertItem[] {
  if (typeof window === "undefined") {
    return seedAlerts;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return seedAlerts;
    }

    const parsed = JSON.parse(stored) as AlertItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedAlerts;
  } catch {
    return seedAlerts;
  }
}

export function writeAlertState(items: AlertItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedState = items;
  notifySubscribers();
}

export function getAlertById(id: string) {
  return readAlertState().find((item) => item.id === id);
}

export function updateAlert(id: string, updater: (alert: AlertItem) => AlertItem) {
  const items = readAlertState();
  const nextItems = items.map((alert) => (alert.id === id ? updater({ ...alert }) : alert));
  writeAlertState(nextItems);
  return nextItems.find((alert) => alert.id === id);
}

// Allocate the next reference for a newly authored alert. References continue the
// existing A-#### sequence so a created alert sits alongside the seed records
// instead of inventing a second id scheme.
export function getNextAlertId(): string {
  const items = readAlertState();
  const max = items.reduce((acc, item) => {
    const match = /^A-(\d+)$/.exec(item.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 1043);
  return `A-${max + 1}`;
}

// Insert a newly authored alert at the top of the list so it is immediately
// visible in Alerts & Advisories and the dashboard's alert panels.
export function createAlert(item: AlertItem): AlertItem {
  const items = readAlertState();
  writeAlertState([item, ...items.filter((entry) => entry.id !== item.id)]);
  return item;
}
