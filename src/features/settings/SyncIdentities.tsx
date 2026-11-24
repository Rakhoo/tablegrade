import { format } from "date-fns";
import {
  linkOidcIdentity,
  type AccountInfo,
  type Identity,
  type OidcProvider,
} from "../../sync";
import { PROVIDER_LABELS } from "../../lib/syncView";
import { OidcButton, ProviderLogo } from "./OidcButton";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** Providers in the order of the buttons. */
const PROVIDERS: OidcProvider[] = ["google", "microsoft"];

/** An identity of Microsoft or Google; passkeys are listed apart. */
type OidcIdentity = Identity & { provider: OidcProvider };

/** Tells Microsoft and Google identities from passkeys. */
const isOidc = (identity: Identity): identity is OidcIdentity =>
  identity.provider != "passkey";

type SyncIdentitiesProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/**
 * The sign-in of this device ("Angemeldet als …"), the linked Microsoft and Google accounts
 * and buttons to link the missing ones.
 */
export function SyncIdentities({ account }: SyncIdentitiesProps) {
  const { busy, error, run } = useSyncAction();
  const { signedInWith } = account;
  const linked = account.identities.filter(isOidc);
  const missing = PROVIDERS.filter(
    (provider) => !linked.some((identity) => identity.provider == provider),
  );
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Anmeldung</h3>
      {signedInWith && (
        <div
          className="flex items-center gap-2 text-sm"
          data-help="Konto, mit dem sich dieses Gerät angemeldet hat. Die E-Mail-Adresse liegt nur auf diesem Gerät, nicht auf dem Server."
        >
          <ProviderLogo provider={signedInWith.provider} />
          <span>
            Angemeldet als{" "}
            <span className="font-medium">
              {signedInWith.email ??
                `${PROVIDER_LABELS[signedInWith.provider]}-Konto`}
            </span>
          </span>
        </div>
      )}
      <ul
        className="flex flex-col gap-1 text-sm text-muted"
        data-help="Konten, mit denen sich ein Gerät bei diesem Notenfeder-Konto anmelden kann."
      >
        {linked.map(({ provider, createdAt }) => (
          <li
            key={`${provider}-${createdAt}`}
            className="flex items-center gap-2"
          >
            <ProviderLogo provider={provider} size={14} />
            {PROVIDER_LABELS[provider]} verknüpft seit{" "}
            {format(createdAt, "dd.MM.yyyy")}
          </li>
        ))}
      </ul>
      <SyncErrorAlert error={error} />
      {missing.length > 0 && (
        <div
          className="flex flex-col items-start gap-2"
          data-help="Verknüpft ein weiteres privates Konto als Anmeldeweg. Die Daten bleiben verschlüsselt."
        >
          {missing.map((provider) => (
            <OidcButton
              key={provider}
              provider={provider}
              label={`${PROVIDER_LABELS[provider]}-Konto verknüpfen`}
              disabled={busy}
              onClick={() => run(() => linkOidcIdentity(provider))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
