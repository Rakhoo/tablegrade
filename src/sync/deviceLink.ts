/**
 * Device link (protocol.md 6, plan B6): the new device shows a code, the old device enters it
 * and sends the data key wrapped with an ECDH key. Both show a check code; the new device takes
 * the key only after the user confirmed that both codes match.
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
  let answer: { publicKey: Bytes; wrapped: Bytes } | null = null;

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

  /** Polls until the old device approved, the code expired or the user cancelled. */
  async function waitForOldDevice(): Promise<string> {
    for (;;) {
      if (cancelled) throw new Error(CANCELLED);
      if (Date.now() > deadline) throw new Error(EXPIRED);
      const result = await api.getLink(linkId).catch((error: unknown) => {
        if (error instanceof ApiError && error.code == "offline") return null;
        throw linkError(error, EXPIRED);
      });
      if (result?.status == "done") {
        answer = {
          publicKey: fromBase64url(result.publicKey),
          wrapped: fromBase64url(result.wrapped),
        };
        return linkCheckCode(own.publicKey, answer.publicKey);
      }
      await pause();
    }
  }

  const checkCode = waitForOldDevice();
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
      if (!answer) throw new Error(FAILED);
      const kek = await deriveLinkKek(own.pair.privateKey, answer.publicKey);
      const key = await unwrapDataKey(
        answer.wrapped,
        kek,
        "link",
        userId,
      ).catch(() => {
        throw new Error(FAILED);
      });
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
