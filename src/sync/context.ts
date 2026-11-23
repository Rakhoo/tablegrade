import type { DataKey } from "../crypto/keys";
import type { Api } from "./api";
import type { SyncDb } from "./syncDb";

/** Everything push and pull need: an unlocked, signed-in device. */
export type SyncContext = {
  /** App database. */
  db: SyncDb;
  /** API client with the session token. */
  api: Api;
  /** Data key of the account. */
  key: DataKey;
  /** Account id; part of the AAD of every record. */
  userId: string;
  /** This device; its own pulled records are skipped. */
  deviceId: string;
};
