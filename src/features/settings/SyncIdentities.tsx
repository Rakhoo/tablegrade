import { Button } from "@mui/material";
import { format } from "date-fns";
import { PlusIcon } from "../../components/icons";
import {
  addPasskey,
  linkOidcIdentity,
  type AccountInfo,
  type IdentityProvider,
  type OidcProvider,
} from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** Names of the sign-in methods for the user. */
const PROVIDER_NAMES: Record<IdentityProvider, string> = {
  passkey: "Passkey",
  microsoft: "Microsoft-Konto",
  google: "Google-Konto",
};

/** Accounts that can be linked, with their button labels. */
const OIDC_LINKS: { provider: OidcProvider; label: string }[] = [
  { provider: "microsoft", label: "Microsoft verknüpfen" },
  { provider: "google", label: "Google verknüpfen" },
];

type SyncIdentitiesProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/**
 * Sign-in methods linked to the account, each with the day it was added, and buttons to add
 * a passkey or link a Microsoft or Google account that is not linked yet.
 */
export function SyncIdentities({ account }: SyncIdentitiesProps) {
  const { busy, error, run } = useSyncAction();
  const linked = new Set(account.identities.map(({ provider }) => provider));
  return (
    <>
      <div
        className="text-sm"
        data-help="Wege, mit denen sich ein Gerät bei diesem Konto anmelden kann."
      >
        <span className="font-medium">Anmeldewege: </span>
        {account.identities
          .map(
            ({ provider, createdAt }) =>
              `${PROVIDER_NAMES[provider]} (seit ${format(createdAt, "dd.MM.yyyy")})`,
          )
          .join(", ")}
      </div>
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        {/* Without an unlocking passkey the offer in SyncAddPasskey has this button */}
        {account.hasPrfPasskey && (
          <Button
            size="small"
            startIcon={<PlusIcon size={16} />}
            disabled={busy}
            onClick={() => run(addPasskey)}
            data-help="Fügt einen weiteren Passkey hinzu, z. B. für ein anderes Gerät. Er kann auch neue Geräte entsperren."
          >
            Passkey hinzufügen
          </Button>
        )}
        {OIDC_LINKS.filter(({ provider }) => !linked.has(provider)).map(
          ({ provider, label }) => (
            <Button
              key={provider}
              size="small"
              startIcon={<PlusIcon size={16} />}
              disabled={busy}
              onClick={() => run(() => linkOidcIdentity(provider))}
              data-help="Verknüpft ein privates Konto als weiteren Anmeldeweg. Die Daten bleiben verschlüsselt."
              data-help-repeat
            >
              {label}
            </Button>
          ),
        )}
      </div>
    </>
  );
}
