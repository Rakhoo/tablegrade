import { useRevalidator } from "react-router";
import { saveSettings } from "../../db";
import type { AppSettings } from "../../lib/settings";

/** Returns a function saving settings and refreshing all pages with them. */
export function useSaveSettings() {
  const { revalidate } = useRevalidator();
  return async (changes: Partial<AppSettings>) => {
    await saveSettings(changes);
    await revalidate();
  };
}
