import { useState } from "react";

/** Message when a step fails without a German reason, e.g. a network error. */
const FALLBACK_ERROR =
  "Das hat nicht geklappt. Bitte später noch einmal versuchen.";

/**
 * Runs account and sync steps one at a time and keeps what the UI needs: whether a step runs
 * and the German error message of the last failed step.
 */
export function useSyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Runs `step`; returns its result, or `undefined` if it failed. */
  const run = async <T>(step: () => Promise<T>) => {
    setBusy(true);
    setError(null);
    try {
      return await step();
    } catch (failure) {
      console.error(failure);
      setError(germanMessage(failure));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}

/**
 * German text for a failed step. The facade raises German messages; browser errors (network,
 * a cancelled passkey dialog) and the placeholder of the missing engine get fixed texts.
 */
function germanMessage(failure: unknown) {
  if (failure instanceof DOMException && failure.name == "NotAllowedError")
    return "Der Vorgang wurde abgebrochen.";
  if (failure instanceof Error && failure.message == "not implemented")
    return "Die Synchronisierung ist in dieser Version noch nicht verfügbar.";
  if (failure instanceof TypeError || failure instanceof DOMException)
    return FALLBACK_ERROR;
  return failure instanceof Error && failure.message
    ? failure.message
    : FALLBACK_ERROR;
}
