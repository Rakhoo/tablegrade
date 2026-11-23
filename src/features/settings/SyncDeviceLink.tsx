import { Button } from "@mui/material";
import { useState } from "react";
import { startDeviceLink, type PendingDeviceLink } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/**
 * Linking on the new device: shows a code for the other device, then the check code that both
 * devices show, and takes over the key once the user confirmed that they match.
 */
export function SyncDeviceLink() {
  const [link, setLink] = useState<PendingDeviceLink | null>(null);
  const [checkCode, setCheckCode] = useState<string | null>(null);
  const { busy, error, run } = useSyncAction();

  /** Gets a code and waits until the other device approved it. */
  const start = async () => {
    const pending = await run(startDeviceLink);
    if (!pending) return;
    setLink(pending);
    const code = await run(() => pending.checkCode);
    if (code) setCheckCode(code);
  };

  /** Stops the link; the code becomes invalid. */
  const cancel = () => {
    link?.cancel();
    setLink(null);
    setCheckCode(null);
  };

  if (!link)
    return (
      <>
        <SyncErrorAlert error={error} />
        <div>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={start}
            data-help="Holt den Schlüssel von einem anderen Gerät, auf dem die Synchronisierung schon läuft."
          >
            Mit anderem Gerät koppeln
          </Button>
        </div>
      </>
    );
  return (
    <div className="flex flex-col gap-2">
      {checkCode ? (
        <p
          className="text-sm"
          data-help="Gleiche Prüfcodes zeigen, dass niemand dazwischen ist."
        >
          Prüfcode: <span className="font-mono text-lg">{checkCode}</span>.
          Zeigt das andere Gerät denselben Prüfcode?
        </p>
      ) : (
        <p
          className="text-sm"
          data-help="Einmal-Code für die Kopplung; er verfällt nach kurzer Zeit."
        >
          Auf dem anderen Gerät unter „Konto & Synchronisierung“ auf „Gerät
          koppeln“ tippen und diesen Code eingeben:{" "}
          <span className="font-mono text-lg">{link.code}</span>
        </p>
      )}
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        {checkCode && (
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => run(link.accept)}
            data-help="Übernimmt den Schlüssel vom anderen Gerät."
          >
            Stimmt überein
          </Button>
        )}
        <Button
          onClick={cancel}
          data-help="Bricht die Kopplung ab; der Code wird ungültig."
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
