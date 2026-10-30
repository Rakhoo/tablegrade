import { useState } from "react";

/**
 * Boolean state kept in the device's local storage, for simple UI preferences.
 * Without storage access (e.g. private mode) it still works for the current session.
 */
export function useStoredBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored == null ? initial : stored == "true";
    } catch {
      return initial;
    }
  });

  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // The preference then only lasts for this session
    }
  };

  return [value, update] as const;
}
