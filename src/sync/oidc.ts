/**
 * OIDC login with Microsoft and Google (plan B4): PKCE and `state` in the browser, code
 * exchange on the server. The provider redirects to the app origin with `code` (or `error`) and
 * `state` in the query; the hash route stays.
 */
import { toBase64url } from "../crypto/encoding";
import { isOidcReturn } from "../lib/oidcReturn";
import { randomBytes, sha256 } from "../crypto/primitives";
import type { Api, SessionGrant } from "./api";
import type { OidcProvider } from "./types";

/** Storage key of the pending login; `localStorage`, so it survives the redirect. */
const PENDING_KEY = "notenfeder-oidc";

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
 * Starts the login: stores PKCE and `state`, then returns the URL to navigate to. An account
 * has exactly one sign-in method, so this only runs while signed out.
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
  // `finishOidcLogin` then checks `state` against the pending login
  if (!isOidcReturn(href)) return null;
  const params = new URL(href).searchParams;
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
  };
}

/**
 * Finishes the login after the redirect: checks `state`, sends the code to the server and
 * removes the pending state. Returns the session and where to
 * go back to.
 * @throws {Error} With a German message if the login failed or was cancelled.
 */
export async function finishOidcLogin(
  api: Api,
  callback: OidcCallback,
  storage: Storage,
): Promise<{
  grant: SessionGrant | undefined;
  provider: OidcProvider;
  returnTo: string;
}> {
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
  return { grant, provider: pending.provider, returnTo: pending.returnTo };
}

/**
 * The URL to start the app with after a provider return: the page the login started on, with
 * the provider's query kept for `finishOidcLogin`. `null` if the URL is no provider return.
 * The hash router reads the route only once, so it must be in place before the router starts.
 */
export function oidcLaunchUrl(href: string, storage: Storage): string | null {
  if (!isOidcReturn(href)) return null;
  const stored = storage.getItem(PENDING_KEY);
  const url = new URL(href);
  const target = new URL(
    stored ? (JSON.parse(stored) as PendingLogin).returnTo : "/",
    url.origin,
  );
  return url.origin + target.pathname + url.search + target.hash;
}

/** The URL without the OIDC query, keeping path and hash route. */
export function withoutOidcQuery(href: string, returnTo?: string): string {
  const url = new URL(href);
  url.search = "";
  if (returnTo) return url.origin + returnTo;
  return url.toString();
}
