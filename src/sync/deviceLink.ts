/**
 * Device link (docs/protocol.md 6): the new device shows a code, the old device enters it
 * and sends its ECDH key, so both show the check code. After the user confirmed on the old
 * device it sends the wrapped data key; the new device takes it only after its own confirmation.
 */
import { fromBase64url, toBase64url, type Bytes } from "../crypto/encoding";
import { unwrapDataKey, wrapDataKey } from "../crypto/keys";
import {
  deriveLinkKek,
  exportPublicKey,
  generateLinkKeyPair,
  linkCheckCode,
} from "../crypto/link";
import { ApiError } from "./api";
import {
  keepDataKey,
  sessionUser,
  unlockedKey,
  type KeyringContext,
} from "./keyring";
import type { DeviceLinkApproval, PendingDeviceLink } from "./types";

/** Time between two `GET /link/{id}` calls while the new device waits. */
export const LINK_POLL_INTERVAL = 3000;

/** Lifetime of a link code on the server. */
export const LINK_LIFETIME = 10 * 60_000;

const EXPIRED = "Der Code ist abgelaufen. Bitte die Kopplung neu starten.";
const CANCELLED = "Die Kopplung wurde abgebrochen.";
const FAILED = "Die Kopplung ist fehlgeschlagen. Bitte neu starten.";

/** A pending link on the new device plus the hook for the WebSocket message `link`. */
export type StartedLink = PendingDeviceLink & {
  /** Server id of the link. */
  linkId: string;
  /** Checks the link now instead of at the next poll, e.g. after a `link` message. */
  notify: () => void;
};

/** A fresh ECDH key pair with its raw public key. */
async function linkKeys() {
  const pair = await generateLinkKeyPair();
  return { pair, publicKey: await exportPublicKey(pair.publicKey) };
}

/** Whether two byte arrays are equal. */
const equalBytes = (a: Bytes, b: Bytes) =>
  a.length == b.length && a.every((value, index) => value == b[index]);

/** Replaces `not_found` with the hint that the code is wrong or expired. */
function linkError(error: unknown, message: string): unknown {
  return error instanceof ApiError && error.code == "not_found"
    ? new Error(message)
    : error;
}

/**
 * New device (signed in, locked): creates the link and waits for the old device. Polls the
 * server; `notify` shortens the wait when the WebSocket reports the link.
 */
export async function startLink(
  { api, store }: KeyringContext,
  pollInterval = LINK_POLL_INTERVAL,
): Promise<StartedLink> {
  const userId = await sessionUser(store);
  const own = await linkKeys();
  const { linkId, code } = await api.startLink(toBase64url(own.publicKey));
  const deadline = Date.now() + LINK_LIFETIME;
  let cancelled = false;
  let wake: (() => void) | null = null;
  let otherKey: Bytes | null = null;
  let wrapped: Bytes | null = null;

  /** Waits for the next poll or an early `notify`. */
  const pause = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(done, pollInterval);
      /** Ends the pause once. */
      function done() {
        clearTimeout(timer);
        wake = null;
        resolve();
      }
      wake = done;
    });

  /** Polls until `ready` holds, the code expired or the user cancelled. */
  async function pollUntil(ready: () => boolean): Promise<void> {
    for (;;) {
      if (cancelled) throw new Error(CANCELLED);
      // The server deletes a finished link after the first read, so never ask again then
      if (ready()) return;
      if (Date.now() > deadline) throw new Error(EXPIRED);
      const result = await api.getLink(linkId).catch((error: unknown) => {
        if (error instanceof ApiError && error.code == "offline") return null;
        throw linkError(error, EXPIRED);
      });
      if (result && result.status != "waiting") {
        const key = fromBase64url(result.publicKey);
        // The key behind the shown check code must not change before the data key arrives
        if (otherKey && !equalBytes(otherKey, key)) throw new Error(FAILED);
        otherKey = key;
        if (result.status == "done") wrapped = fromBase64url(result.wrapped);
      }
      if (!ready()) await pause();
    }
  }

  // The old device sends its key before the user confirms there, so both show the code
  const checkCode = pollUntil(() => otherKey != null).then(() =>
    linkCheckCode(own.publicKey, otherKey!),
  );
  // The UI may cancel without awaiting the code; avoid an unhandled rejection then.
  checkCode.catch(() => {});

  return {
    linkId,
    code,
    checkCode,
    notify: () => wake?.(),
    cancel: () => {
      cancelled = true;
      wake?.();
    },
    accept: async () => {
      // Waits until the old device confirmed the same check code and sent the data key
      await pollUntil(() => wrapped != null);
      const kek = await deriveLinkKek(own.pair.privateKey, otherKey!);
      const key = await unwrapDataKey(wrapped!, kek, "link", userId).catch(
        () => {
          throw new Error(FAILED);
        },
      );
      await keepDataKey(store, userId, key);
    },
  };
}

/**
 * Old device (unlocked): looks up the code the new device shows. `approve` sends the wrapped
 * data key after the user compared the check codes.
 */
export async function findLink(
  { api, store }: KeyringContext,
  code: string,
): Promise<DeviceLinkApproval> {
  const { userId, key } = await unlockedKey(store);
  if (!code.trim()) throw new Error("Bitte den Code eingeben.");
  const found = await api.findLink(code.trim()).catch((error: unknown) => {
    throw linkError(error, "Der Code ist falsch oder abgelaufen.");
  });
  const newPublic = fromBase64url(found.publicKey);
  const own = await linkKeys();
  await api
    .setLinkKey(found.linkId, toBase64url(own.publicKey))
    .catch((error: unknown) => {
      throw linkError(error, EXPIRED);
    });
  return {
    checkCode: await linkCheckCode(newPublic, own.publicKey),
    approve: async () => {
      const kek = await deriveLinkKek(own.pair.privateKey, newPublic);
      const wrapped = await wrapDataKey(key, kek, "link", userId);
      await api
        .completeLink(
          found.linkId,
          toBase64url(own.publicKey),
          toBase64url(wrapped),
        )
        .catch((error: unknown) => {
          throw linkError(error, EXPIRED);
        });
    },
  };
}
