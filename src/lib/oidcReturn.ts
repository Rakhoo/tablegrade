/**
 * Whether a URL is the return from a Microsoft or Google sign-in. The redirect URI carries no
 * marker (Microsoft forbids a query), so `state` plus a result (`code` or `error`) identifies
 * it. Shared by the sync sign-in and the launch URL reset, which must leave such a URL alone.
 */
export function isOidcReturn(href: string): boolean {
  const params = new URL(href).searchParams;
  return params.has("state") && (params.has("code") || params.has("error"));
}
