"use client";

import { incidents as seedIncidents, type IncidentItem } from "@/app/dashboard/mock-data";

const STORAGE_KEY = "ice-incident-state-v2";

let cachedState: IncidentItem[] | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function subscribeToIncidentState(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getIncidentStateSnapshot(): IncidentItem[] {
  if (cachedState === null) {
    cachedState = readIncidentState();
  }
  return cachedState;
}

export function getIncidentStateServerSnapshot(): IncidentItem[] {
  return seedIncidents;
}

export function readIncidentState(): IncidentItem[] {
  if (typeof window === "undefined") {
    return seedIncidents;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return seedIncidents;
    }

    const parsed = JSON.parse(stored) as IncidentItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedIncidents;
  } catch {
    return seedIncidents;
  }
}

export function writeIncidentState(items: IncidentItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedState = items;
  notifySubscribers();
}

export function getIncidentById(id: string) {
  return readIncidentState().find((item) => item.id === id);
}

export function updateIncident(id: string, updater: (incident: IncidentItem) => IncidentItem) {
  const items = readIncidentState();
  const nextItems = items.map((incident) => (incident.id === id ? updater({ ...incident }) : incident));
  writeIncidentState(nextItems);
  return nextItems.find((incident) => incident.id === id);
}
