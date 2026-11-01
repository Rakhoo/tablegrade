/**
 * The PIN lock stays hidden until accounts exist: without a backend a forgotten PIN could not
 * be reset. Enabling this brings back the lock screen and the settings.
 */
export const PIN_LOCK_ENABLED = false;

/** Hashes a PIN, so it is not stored in plain text. */
export async function hashPin(pin: string) {
  const data = new TextEncoder().encode(`tablegrade:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
