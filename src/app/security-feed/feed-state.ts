"use client";

import { feeds as seedFeeds, type FeedItem } from "@/app/dashboard/mock-data";

// Shared Security Feed store. The Risk Dashboard and the Security Feed page both
// read from this single source, so a publish/pin/withdraw here is reflected on
// the dashboard without a reload. Mirrors the alert and incident store pattern.
const STORAGE_KEY = "ice-security-feed-state-v1";

let cachedState: FeedItem[] | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

export function subscribeToFeedState(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getFeedStateSnapshot(): FeedItem[] {
  if (cachedState === null) {
    cachedState = readFeedState();
  }
  return cachedState;
}

export function getFeedStateServerSnapshot(): FeedItem[] {
  return seedFeeds;
}

export function readFeedState(): FeedItem[] {
  if (typeof window === "undefined") {
    return seedFeeds;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return seedFeeds;
    }

    const parsed = JSON.parse(stored) as FeedItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedFeeds;
  } catch {
    return seedFeeds;
  }
}

export function writeFeedState(items: FeedItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedState = items;
  notifySubscribers();
}

export function getFeedItemById(id: string) {
  return readFeedState().find((item) => item.id === id);
}

export function updateFeedItem(id: string, updater: (item: FeedItem) => FeedItem) {
  const items = readFeedState();
  const nextItems = items.map((item) => (item.id === id ? updater({ ...item }) : item));
  writeFeedState(nextItems);
  return nextItems.find((item) => item.id === id);
}

// Allocate the next reference for a newly authored item. References follow the
// existing FD-#### sequence so a newly created item sits alongside the seed
// records instead of inventing a second id scheme.
export function getNextFeedId(): string {
  const items = readFeedState();
  const max = items.reduce((acc, item) => {
    const match = /^FD-(\d+)$/.exec(item.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 2100);
  return `FD-${max + 1}`;
}

// Insert a newly authored item at the top of the list so it is immediately
// visible in the Security Feed and the dashboard's Security Feed Activity panel.
export function createFeedItem(item: FeedItem): FeedItem {
  const items = readFeedState();
  writeFeedState([item, ...items.filter((entry) => entry.id !== item.id)]);
  return item;
}
