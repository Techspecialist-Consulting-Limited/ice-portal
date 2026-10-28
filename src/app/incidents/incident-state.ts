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

  const seedTypesById = new Map(
    seedIncidents.flatMap((incident) =>
      incident.incidentType ? [[incident.id, incident.incidentType] as const] : [],
    ),
  );
  let migrated = false;
  const incidentsWithSeedTypes = parsed.map((incident) => {
    if (incident.incidentType) return incident;
    const incidentType = seedTypesById.get(incident.id);
    if (!incidentType) return incident;
    migrated = true;
    return { ...incident, incidentType };
  });

  if (migrated) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(incidentsWithSeedTypes));
  }
  return incidentsWithSeedTypes;
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
