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

  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return seedIncidents;
  }
  if (!stored) return seedIncidents;

  let parsed: IncidentItem[];
  try {
    parsed = JSON.parse(stored) as IncidentItem[];
  } catch {
    return seedIncidents;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return seedIncidents;

  const seedById = new Map(seedIncidents.map((incident) => [incident.id, incident] as const));
  let migrated = false;
  const incidentsWithSeedFields = parsed.map((incident) => {
    const seed = seedById.get(incident.id);
    if (!seed) return incident;
    // Location is not editable in the incident workflow, so persisted demo
    // sessions can safely pick up the current seed location.
    if (incident.incidentType && incident.location === seed.location) return incident;
    migrated = true;
    return {
      ...incident,
      incidentType: incident.incidentType ?? seed.incidentType,
      location: seed.location,
    };
  });

  if (migrated) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(incidentsWithSeedFields));
  }
  return incidentsWithSeedFields;
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
