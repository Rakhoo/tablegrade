import { format } from "date-fns";
import type { AccountInfo, IdentityProvider } from "../../sync";

/** Names of the sign-in methods for the user. */
const PROVIDER_NAMES: Record<IdentityProvider, string> = {
  passkey: "Passkey",
  microsoft: "Microsoft-Konto",
  google: "Google-Konto",
};

type SyncIdentitiesProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/** Sign-in methods linked to the account, each with the day it was added. */
export function SyncIdentities({ account }: SyncIdentitiesProps) {
  return (
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
  );
}
