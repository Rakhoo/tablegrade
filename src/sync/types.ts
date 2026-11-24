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
 * - `upgradeRequired`: the server or another device uses a newer version; update the app.
 */
export type SyncPhase =
  | "off"
  | "signedOut"
  | "locked"
  | "idle"
  | "syncing"
  | "offline"
  | "error"
  | "upgradeRequired"
  | "notApproved"
  | "setupIncomplete";

/** A sign-in method linked to the account. */
export type Identity = {
  /** Provider of the identity. */
  provider: IdentityProvider;
  /** Time of linking (Unix ms). */
  createdAt: number;
};

/** The signed-in account as seen by this device. */
/** The OIDC account this device signed in with, as shown to the user. */
export type SignedInWith = {
  provider: OidcProvider;
  /** Email of the provider account; `null` if the provider sent none. */
  email: string | null;
};

export type AccountInfo = {
  /** Server user id (UUID). */
  userId: string;
  /** Server id of this device (UUID). */
  deviceId: string;
  /** Linked sign-in methods. */
  identities: Identity[];
  /** Whether the server already holds a wrapped data key, i.e. the account is not new. */
  hasDataKey: boolean;
  /** Whether the account has a recovery key; sync starts only after it was created. */
  hasRecoveryKey: boolean;
  /** Whether a passkey with PRF exists, so the device can unlock with a passkey. */
  hasPrfPasskey: boolean;
  /** Sign-in of this device; `null` for sessions from before it was recorded. */
  signedInWith: SignedInWith | null;
  /** Whether the operator approved the account; until then it cannot sync. */
  approved: boolean;
  /** Contact address for approval, maintenance and billing mails. */
  contactEmail: string | null;
  /** Free text of the access request, e.g. who recommended the app. */
  accessNote: string | null;
};

/** Progress of the first upload or download, counted in records. */
export type SyncProgress = {
  /** Items done so far. */
  done: number;
  /** Items in total. */
  total: number;
  /** What is counted: records first, then the photos they refer to. */
  unit: ProgressUnit;
};

/** What a progress counts. */
export type ProgressUnit = "records" | "photos";

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
  /** Set during the first upload or download, otherwise `null`. */
  progress: SyncProgress | null;
  /** Set after an imported backup turned sync off, until dismissed or sync is turned on. */
  importNotice: boolean;
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
