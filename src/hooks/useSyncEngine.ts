import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { startSync, subscribeSyncApplied } from "../sync";

/**
 * Starts sync once when the app opens and reloads the route data whenever data from other
 * devices was written. Used by the root layout.
 */
export function useSyncEngine() {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    startSync().catch((error: unknown) => console.error(error));
  }, []);

  useEffect(() => subscribeSyncApplied(() => void revalidate()), [revalidate]);
}
