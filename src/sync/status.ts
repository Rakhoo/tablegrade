import type { SyncStatus } from "./types";

/** Status before anything is known, and while sync is disabled. */
export const OFF_STATUS: SyncStatus = {
  phase: "off",
  account: null,
  lastSyncAt: null,
  pending: 0,
  error: null,
};

/** Latest snapshot; replaced, never mutated. */
let current = OFF_STATUS;
const listeners = new Set<() => void>();

/** Current status snapshot; stable between changes, as `useSyncExternalStore` requires. */
export function readStatus() {
  return current;
}

/** Merges `change` into the status and notifies all listeners. */
export function updateStatus(change: Partial<SyncStatus>) {
  current = { ...current, ...change };
  listeners.forEach((listener) => listener());
}

/** Registers a listener for status changes; returns the function to remove it. */
export function addStatusListener(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
