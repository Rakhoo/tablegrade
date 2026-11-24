import { PROVIDER_LABELS } from "../../lib/syncView";
import type { AccountInfo, OidcProvider } from "../../sync";
import { ProviderLogo } from "./OidcButton";

type SyncSignedInProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/**
 * The one sign-in method of the account, with the email of the sign-in of this device. Older
 * sessions know only the provider from the account's identities.
 */
export function SyncSignedIn({ account }: SyncSignedInProps) {
  const provider =
    account.signedInWith?.provider ??
    account.identities
      .map((identity) => identity.provider)
      .find((name): name is OidcProvider => name != "passkey");
  if (!provider) return null;
  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-help="Anmeldeweg des Kontos. Ein Konto hat genau einen; zum Wechseln abmelden und mit dem anderen anmelden. Die E-Mail-Adresse liegt nur auf diesem Gerät."
    >
      <ProviderLogo provider={provider} />
      <span>
        Angemeldet mit {PROVIDER_LABELS[provider]}
        {account.signedInWith?.email && (
          <>
            {" als "}
            <span className="font-medium">{account.signedInWith.email}</span>
          </>
        )}
      </span>
    </div>
  );
}
