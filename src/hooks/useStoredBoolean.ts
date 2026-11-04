import { useSyncExternalStore } from "react";

/** Listeners per storage key, so every component using a key sees its changes at once. */
const listeners = new Map<string, Set<() => void>>();
/** Values of this session, also without storage access (e.g. private mode). */
const values = new Map<string, boolean>();

function read(key: string, initial: boolean) {
  if (!values.has(key)) {
    let value = initial;
    try {
      const stored = localStorage.getItem(key);
      if (stored != null) value = stored == "true";
    } catch {
      // The initial value applies then
    }
    values.set(key, value);
  }
  return values.get(key)!;
}

function write(key: string, value: boolean) {
  values.set(key, value);
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The preference then only lasts for this session
  }
  listeners.get(key)?.forEach((listener) => listener());
}

/**
 * Boolean state kept in the device's local storage, for simple UI preferences. All
 * components using the same key share it, also across pages.
 */
export function useStoredBoolean(key: string, initial: boolean) {
  const value = useSyncExternalStore(
    (listener) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(listener);
      return () => listeners.get(key)!.delete(listener);
    },
    () => read(key, initial),
  );
  return [value, (next: boolean) => write(key, next)] as const;
}
