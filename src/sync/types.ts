/** Ways to sign in; mirrors `identities.provider` on the server. */
export type IdentityProvider = "passkey" | "microsoft" | "google";

/** Providers for the OIDC redirect login. */
export type OidcProvider = Exclude<IdentityProvider, "passkey">;

/**
 * State of sync on this device:
 * - `off`: sync is disabled, the app works as before.
 * - `signedOut`: sync is enabled but no valid session exists (e.g. after a revoked sign-in).
 * - `locked`: signed in, but this device has no data key yet (unlock or link the device).
 * - `idle`: everything is sent and received.
 * - `syncing`: a push or pull runs.
 * - `offline`: the server is not reachable; changes wait in the outbox.
 * - `error`: the last attempt failed, see `SyncStatus.error`.
 * - `upgradeRequired`: the server or the data needs a newer app version (HTTP 426).
 */
export type SyncPhase =
  | "off"
  | "signedOut"
  | "locked"
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "upgradeRequired";

/** A sign-in method linked to the account. */
export type Identity = {
  /** Provider of the identity. */
  provider: IdentityProvider;
  /** Time of linking (Unix ms). */
  createdAt: number;
};

/** The signed-in account as seen by this device. */
export type AccountInfo = {
  /** Server user id (UUID). */
  userId: string;
  /** Server id of this device (UUID). */
  deviceId: string;
  /** Linked sign-in methods. */
  identities: Identity[];
  /** Whether the server already has a wrapped data key; `false` for a new account. */
  hasDataKey: boolean;
  /** Whether a passkey of the account can unlock the data key (PRF). */
  hasPrfPasskey: boolean;
};

/** Snapshot of the sync state for the UI. Replaced as a whole on every change. */
export type SyncStatus = {
  /** Current phase. */
  phase: SyncPhase;
  /** Signed-in account, `null` when signed out or off. */
  account: AccountInfo | null;
  /** Time of the last complete sync (Unix ms). */
  lastSyncAt: number | null;
  /** Local changes not yet sent. */
  pending: number;
  /** German message for the UI when `phase` is `error`. */
  error: string | null;
};

/** A device of the account. */
export type Device = {
  /** Server id (UUID). */
  id: string;
  /** Name chosen at sign-in, e.g. "iPad Schule". */
  name: string;
  /** Time of the first sign-in (Unix ms). */
  createdAt: number;
  /** Time of the last server contact (Unix ms). */
  lastSeenAt: number;
  /** Time of revocation (Unix ms), `null` while active. */
  revokedAt: number | null;
  /** Whether this is the device the app runs on. */
  current: boolean;
};

/** Result of a sign-in or sign-up. */
export type SignInResult = {
  /** Whether the sign-in created a new account. */
  isNewUser: boolean;
  /** Whether the device still needs the data key (unlock or link). */
  needsUnlock: boolean;
};

/** Device link as started on the new device (protocol.md 6). */
export type PendingDeviceLink = {
  /** Code to show; the old device enters it. */
  code: string;
  /** Resolves with the 6-digit check code once the old device has approved. */
  checkCode: Promise<string>;
  /** Takes over the data key after the user compared the check codes. */
  accept: () => Promise<void>;
  /** Stops the link; the code becomes invalid. */
  cancel: () => void;
};

/** Device link as seen on the old device after entering the code. */
export type DeviceLinkApproval = {
  /** 6-digit check code; must match the one on the new device. */
  checkCode: string;
  /** Sends the wrapped data key to the new device. */
  approve: () => Promise<void>;
};
