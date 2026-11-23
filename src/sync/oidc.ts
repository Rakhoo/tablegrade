/**
 * OIDC login with Microsoft and Google (plan B4): PKCE and `state` in the browser, code
 * exchange on the server. The provider redirects to `/?oidc=callback`; the hash route stays.
 */
import { toBase64url } from "../crypto/encoding";
import { randomBytes, sha256 } from "../crypto/primitives";
import type { Api, SessionGrant } from "./api";
import type { OidcProvider } from "./types";

/** Storage key of the pending login; `localStorage`, so it survives the redirect. */
const PENDING_KEY = "notenfeder-oidc";

/** Query value that marks the return from the provider. */
const CALLBACK = "callback";

/** Login state kept across the redirect. */
type PendingLogin = {
  provider: OidcProvider;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  deviceName: string;
  /** Path and hash to return to after the login. */
  returnTo: string;
};

/** Parameters of the return from the provider. */
export type OidcCallback = {
  code: string | null;
  state: string | null;
  error: string | null;
};

/** Builds the authorize URL with PKCE (`S256`). */
export async function authorizeUrl(
  config: Awaited<ReturnType<Api["oidcConfig"]>>,
  state: string,
  codeVerifier: string,
): Promise<string> {
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: toBase64url(await sha256(codeVerifier)),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/**
 * Starts the login: stores PKCE and `state`, then returns the URL to navigate to. With a
 * session token the server links the identity to the signed-in account instead.
 */
export async function beginOidcLogin(
  api: Api,
  provider: OidcProvider,
  deviceName: string,
  storage: Storage,
  returnTo: string,
): Promise<string> {
  const config = await api.oidcConfig(provider);
  const pending: PendingLogin = {
    provider,
    state: toBase64url(randomBytes(16)),
    codeVerifier: toBase64url(randomBytes(32)),
    redirectUri: config.redirectUri,
    deviceName,
    returnTo,
  };
  storage.setItem(PENDING_KEY, JSON.stringify(pending));
  return authorizeUrl(config, pending.state, pending.codeVerifier);
}

/** Reads the provider's answer from a URL; `null` if it is no OIDC return. */
export function parseOidcCallback(href: string): OidcCallback | null {
  const params = new URL(href).searchParams;
  if (params.get("oidc") != CALLBACK) return null;
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
  };
}

/**
 * Finishes the login after the redirect: checks `state`, sends the code to the server and
 * removes the pending state. Returns the session and where to go back to.
 * @throws {Error} With a German message if the login failed or was cancelled.
 */
export async function finishOidcLogin(
  api: Api,
  callback: OidcCallback,
  storage: Storage,
): Promise<{ grant: SessionGrant; returnTo: string }> {
  const stored = storage.getItem(PENDING_KEY);
  storage.removeItem(PENDING_KEY);
  const pending = stored ? (JSON.parse(stored) as PendingLogin) : null;
  if (callback.error == "access_denied")
    throw new Error("Die Anmeldung wurde abgebrochen.");
  if (!pending || !callback.code || callback.state != pending.state)
    throw new Error("Die Anmeldung ist fehlgeschlagen. Bitte neu versuchen.");
  const grant = await api.oidcExchange(pending.provider, {
    code: callback.code,
    codeVerifier: pending.codeVerifier,
    redirectUri: pending.redirectUri,
    deviceName: pending.deviceName,
  });
  return { grant, returnTo: pending.returnTo };
}

/** The URL without the OIDC query, keeping path and hash route. */
export function withoutOidcQuery(href: string, returnTo?: string): string {
  const url = new URL(href);
  url.search = "";
  if (returnTo) return url.origin + returnTo;
  return url.toString();
}
