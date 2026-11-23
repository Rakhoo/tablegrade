import { useSyncExternalStore } from "react";
import { getSyncStatus, subscribeSyncStatus } from "../sync";

/** Current sync status; re-renders on every change. */
export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}
