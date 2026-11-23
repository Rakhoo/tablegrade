/**
 * Typed client of the sync server (docs/sync-plan/protocol.md). Every failure becomes an
 * `ApiError` with a German message for the UI.
 */
import type { Device, IdentityProvider, OidcProvider } from "./types";

/** Error codes of the protocol plus `offline` for network failures. */
export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "session_revoked"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "gone"
  | "server_restored"
  | "too_large"
  | "upgrade_required"
  | "rate_limited"
  | "server_error"
  | "offline";

/** German fallback messages when the server sends none (or is not reachable). */
const MESSAGES: Record<ApiErrorCode, string> = {
  bad_request: "Die Anfrage war ungültig.",
  unauthorized: "Bitte neu anmelden.",
  session_revoked: "Dieses Gerät wurde abgemeldet. Bitte neu anmelden.",
  forbidden: "Das ist nicht erlaubt.",
  not_found: "Nicht gefunden.",
  conflict: "Das geht gerade nicht.",
  gone: "Die Daten müssen neu geladen werden.",
  server_restored:
    "Der Server wurde zurückgesetzt. Die Daten werden neu hochgeladen.",
  too_large: "Die Daten sind zu groß.",
  upgrade_required: "Bitte die App aktualisieren.",
  rate_limited: "Zu viele Versuche. Bitte später noch einmal.",
  server_error: "Der Server hat einen Fehler gemeldet.",
  offline: "Keine Verbindung zum Server.",
};

/** A failed server call. `message` is German and can be shown as is. */
export class ApiError extends Error {
  /** Protocol error code. */
  readonly code: ApiErrorCode;
  /** HTTP status; 0 for network failures. */
  readonly status: number;
  /** Seconds to wait from `Retry-After`, for `rate_limited`. */
  readonly retryAfter: number | null;

  constructor(
    code: ApiErrorCode,
    status: number,
    message?: string,
    retryAfter: number | null = null,
  ) {
    super(message || MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Protocol major version sent and expected in `X-Protocol-Version`. */
export const PROTOCOL_VERSION = "1";

/** Response of a successful sign-in. */
export type SessionGrant = {
  sessionToken: string;
  userId: string;
  deviceId: string;
  isNewUser: boolean;
};

/** Response of `GET /auth/session`. */
export type SessionInfo = {
  userId: string;
  deviceId: string;
  identities: { provider: IdentityProvider; createdAt: number }[];
  devices: Device[];
};

/** WebAuthn options as JSON plus the challenge to answer. */
export type WebAuthnChallenge<T> = { challengeId: string; options: T };

/** Browser config of an OIDC provider. */
export type OidcConfig = {
  clientId: string;
  authorizeUrl: string;
  scopes: string[];
  redirectUri: string;
};

/** A key wrap as stored on the server (protocol.md 3). */
export type KeyWrap = {
  id: string;
  kind: "passkey" | "recovery";
  credentialId?: string;
  alg: string;
  wrapped: string;
  createdAt: number;
};

/** A record to push. */
export type OutgoingRecord = {
  id: string;
  deleted: boolean;
  schema: number;
  ciphertext: string;
  blobs: string[];
};

/** A record as pulled. */
export type IncomingRecord = {
  id: string;
  seq: number;
  updatedAt: number;
  deleted: boolean;
  schema: number;
  ciphertext: string;
  deviceId: string;
};

/** Response of `GET /records/pull`. */
export type PullResult = {
  records: IncomingRecord[];
  more: boolean;
  latestSeq: number;
};

/** State of a device link as seen by the new device. */
export type LinkResult =
  | { status: "waiting" }
  | { status: "done"; publicKey: string; wrapped: string };

/** Dependencies of the client; tests pass a fake `fetch`. */
export type ApiOptions = {
  /** Server origin without `/api/v1`, e.g. `https://pi.example.ts.net`. */
  baseUrl: string;
  /** Current session token, `null` while signed out. */
  getToken: () => string | null;
  /** Fetch implementation; defaults to the global one. */
  fetch?: typeof fetch;
};

/** Request options of `call`. */
type CallOptions = {
  method?: string;
  body?: unknown;
  /** Raw body sent as `application/octet-stream`. */
  bytes?: Uint8Array<ArrayBuffer>;
  /** Return the raw response body instead of JSON. */
  binary?: boolean;
};

/** Maps a failed response to an `ApiError`. */
async function toError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: ApiErrorCode;
    message?: string;
  } | null;
  const code =
    body?.error && body.error in MESSAGES
      ? body.error
      : response.status >= 500
        ? "server_error"
        : "bad_request";
  const retryAfter = Number(response.headers.get("Retry-After")) || null;
  return new ApiError(code, response.status, body?.message, retryAfter);
}

/** Creates the API client; all paths are relative to `<baseUrl>/api/v1`. */
export function createApi({ baseUrl, getToken, fetch: doFetch }: ApiOptions) {
  const root = `${baseUrl.replace(/\/$/, "")}/api/v1`;

  /** Sends one request and decodes the answer. */
  async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      "X-Protocol-Version": PROTOCOL_VERSION,
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (options.bytes) headers["Content-Type"] = "application/octet-stream";
    let response: Response;
    try {
      response = await (doFetch ?? fetch)(root + path, {
        method: options.method ?? (options.body ? "POST" : "GET"),
        headers,
        body:
          options.bytes ??
          (options.body === undefined
            ? undefined
            : JSON.stringify(options.body)),
      });
    } catch {
      throw new ApiError("offline", 0);
    }
    if (!response.ok) throw await toError(response);
    if (options.binary)
      return new Uint8Array(await response.arrayBuffer()) as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Path segment with escaping, for ids from the server or the user. */
  const segment = encodeURIComponent;

  return {
    passkeyRegisterBegin: () =>
      call<WebAuthnChallenge<PublicKeyCredentialCreationOptionsJSON>>(
        "/auth/passkey/register/begin",
        { body: {} },
      ),
    passkeyRegisterFinish: (
      challengeId: string,
      credential: unknown,
      deviceName: string,
    ) =>
      call<SessionGrant | undefined>("/auth/passkey/register/finish", {
        body: { challengeId, credential, deviceName },
      }),
    passkeyLoginBegin: () =>
      call<WebAuthnChallenge<PublicKeyCredentialRequestOptionsJSON>>(
        "/auth/passkey/login/begin",
        { body: {} },
      ),
    passkeyLoginFinish: (
      challengeId: string,
      credential: unknown,
      deviceName: string,
    ) =>
      call<SessionGrant>("/auth/passkey/login/finish", {
        body: { challengeId, credential, deviceName },
      }),
    oidcConfig: (provider: OidcProvider) =>
      call<OidcConfig>(`/auth/oidc/${provider}/config`),
    oidcExchange: (
      provider: OidcProvider,
      body: {
        code: string;
        codeVerifier: string;
        redirectUri: string;
        deviceName: string;
      },
    ) =>
      // With a session the server links the identity and answers 204 without a body
      call<SessionGrant | undefined>(`/auth/oidc/${provider}/exchange`, {
        body,
      }),
    session: () => call<SessionInfo>("/auth/session"),
    logout: () => call<void>("/auth/logout", { method: "POST" }),
    listDevices: () =>
      call<{ devices: Device[] }>("/devices").then((result) => result.devices),
    revokeDevice: (id: string) =>
      call<void>(`/devices/${segment(id)}/revoke`, { method: "POST" }),
    renameDevice: (id: string, name: string) =>
      call<void>(`/devices/${segment(id)}`, {
        method: "PATCH",
        body: { name },
      }),
    deleteAccount: () => call<void>("/account", { method: "DELETE" }),
    listKeys: () =>
      call<{ keys: KeyWrap[] }>("/keys").then((result) => result.keys),
    putKey: (wrap: KeyWrap) =>
      call<void>(`/keys/${segment(wrap.id)}`, { method: "PUT", body: wrap }),
    deleteKey: (id: string) =>
      call<void>(`/keys/${segment(id)}`, { method: "DELETE" }),
    push: (records: OutgoingRecord[]) =>
      call<{ results: { id: string; seq: number; updatedAt: number }[] }>(
        "/records/push",
        { body: { records } },
      ).then((result) => result.results),
    pull: (after: number, limit?: number) =>
      call<PullResult>(
        `/records/pull?after=${after}${limit ? `&limit=${limit}` : ""}`,
      ),
    putBlob: (blobId: string, bytes: Uint8Array<ArrayBuffer>) =>
      call<void>(`/blobs/${segment(blobId)}`, { method: "PUT", bytes }),
    getBlob: (blobId: string) =>
      call<Uint8Array<ArrayBuffer>>(`/blobs/${segment(blobId)}`, {
        binary: true,
      }),
    startLink: (publicKey: string) =>
      call<{ linkId: string; code: string }>("/link", { body: { publicKey } }),
    findLink: (code: string) =>
      call<{ linkId: string; publicKey: string }>(
        `/link/by-code/${segment(code)}`,
      ),
    completeLink: (linkId: string, publicKey: string, wrapped: string) =>
      call<void>(`/link/${segment(linkId)}/complete`, {
        body: { publicKey, wrapped },
      }),
    getLink: (linkId: string) => call<LinkResult>(`/link/${segment(linkId)}`),
    /** WebSocket URL with the token in the query (protocol.md 1). */
    socketUrl: (token: string) =>
      `${root.replace(/^http/, "ws")}/ws?token=${segment(token)}`,
  };
}

/** The API client type, e.g. for fakes in tests. */
export type Api = ReturnType<typeof createApi>;
