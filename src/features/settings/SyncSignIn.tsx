import { TextField } from "@mui/material";
import { useState } from "react";
import { startOidcLogin, type OidcProvider } from "../../sync";
import { PROVIDER_LABELS } from "../../lib/syncView";
import { OidcButton } from "./OidcButton";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** Providers in the order of the buttons. */
const PROVIDERS: OidcProvider[] = ["google", "microsoft"];

/** A name for this device that the list of devices shows until it is renamed. */
function guessDeviceName() {
  const agent = navigator.userAgent;
  if (/iPad|Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
    return "iPad";
  if (/iPhone/.test(agent)) return "iPhone";
  if (/Android/.test(agent)) return "Android-Gerät";
  return "Computer";
}

/**
 * Sign-in with Microsoft or Google; the first sign-in creates the account. Passkeys come only
 * after signing in, to unlock the data. The device name tells the devices apart.
 */
export function SyncSignIn() {
  const [deviceName, setDeviceName] = useState(guessDeviceName);
  const { busy, error, run } = useSyncAction();
  const name = deviceName.trim();
  return (
    <>
      <TextField
        size="small"
        label="Name dieses Geräts"
        value={deviceName}
        onChange={(event) => setDeviceName(event.target.value)}
        className="max-w-72"
        helperText="Z. B. „iPad Schule“; erscheint in der Geräteliste."
        data-help="Name, unter dem dieses Gerät in der Liste der Geräte des Kontos steht."
      />
      <SyncErrorAlert error={error} />
      <div
        className="flex flex-col items-start gap-2"
        data-help="Anmeldung mit einem privaten Konto. Beim ersten Mal entsteht das Notenfeder-Konto. Die Daten bleiben verschlüsselt; der Anbieter sieht sie nie."
      >
        {PROVIDERS.map((provider) => (
          <OidcButton
            key={provider}
            provider={provider}
            label={`Mit ${PROVIDER_LABELS[provider]} anmelden`}
            disabled={busy || !name}
            onClick={() => run(() => startOidcLogin(provider, name))}
          />
        ))}
      </div>
    </>
  );
}
