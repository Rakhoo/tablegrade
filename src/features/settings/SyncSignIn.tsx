import { Button, TextField } from "@mui/material";
import { useState } from "react";
import {
  loginWithPasskey,
  startOidcLogin,
  startPasskeySignup,
  type OidcProvider,
  type SignInResult,
} from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

type SyncSignInProps = {
  /** Offers creating a new account; off when an existing sign-in expired. */
  allowSignup: boolean;
  /** Called after a passkey sign-in or sign-up, e.g. to start the key setup of a new account. */
  onSignedIn: (result: SignInResult) => void;
};

/** Sign-in methods besides the passkey, with their button labels. */
const OIDC_PROVIDERS: { provider: OidcProvider; label: string }[] = [
  { provider: "microsoft", label: "Mit Microsoft anmelden" },
  { provider: "google", label: "Mit Google anmelden" },
];

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
 * Choice of the sign-in method: a new account with a passkey, or signing in with a passkey,
 * Microsoft or Google. The device name tells the devices of the account apart.
 */
export function SyncSignIn({ allowSignup, onSignedIn }: SyncSignInProps) {
  const [deviceName, setDeviceName] = useState(guessDeviceName);
  const { busy, error, run } = useSyncAction();
  const name = deviceName.trim();
  const disabled = busy || !name;

  /** Runs a passkey step and reports its result. */
  const signIn = async (
    step: (deviceName: string) => Promise<SignInResult>,
  ) => {
    const result = await run(() => step(name));
    if (result) onSignedIn(result);
  };
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
        className="flex flex-wrap gap-2"
        data-help="Anmeldewege: Passkey (Face ID, Touch ID oder Gerätecode), privates Microsoft- oder Google-Konto."
      >
        {allowSignup && (
          <Button
            variant="contained"
            disabled={disabled}
            onClick={() => signIn(startPasskeySignup)}
          >
            Neues Konto mit Passkey
          </Button>
        )}
        <Button
          variant={allowSignup ? "outlined" : "contained"}
          disabled={disabled}
          onClick={() => signIn(loginWithPasskey)}
        >
          Mit Passkey anmelden
        </Button>
        {OIDC_PROVIDERS.map(({ provider, label }) => (
          <Button
            key={provider}
            variant="outlined"
            disabled={disabled}
            onClick={() => run(() => startOidcLogin(provider, name))}
          >
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}
