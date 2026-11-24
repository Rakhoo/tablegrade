/**
 * Adding a passkey and unlocking with one (plan B4): server challenge, browser dialog, server
 * check, then the data key via `keyring`. Signing in is left to Microsoft and Google.
 */
import {
  addPasskeyWrap,
  passkeyWrapIds,
  unlockWithPrf,
  type KeyringContext,
  type PrfResult,
} from "./keyring";
import {
  createPasskey,
  evaluatePrf,
  PasskeyExistsError,
  type PasskeyResult,
} from "./webauthn";

/** Why a passkey is refused; Windows Hello often lacks PRF, the Google Password Manager has it. */
const NO_PRF =
  "Dieser Passkey kann die Daten nicht entsperren. Unter Windows „Google Passwortmanager“ statt „Windows-Sicherheit“ wählen, sonst z. B. iCloud-Schlüsselbund oder Bitwarden.";

/**
 * PRF output of a passkey. Many authenticators report only `enabled` at registration; then a
 * second dialog evaluates PRF. It passes no credential list (see `unlockWithPasskey`), so the
 * user picks the passkey just created; another one does not count.
 */
async function prfOf(
  passkey: PasskeyResult,
  rpId: string | undefined,
): Promise<PrfResult | null> {
  const { credentialId } = passkey;
  if (passkey.prfOutput) return { credentialId, prfOutput: passkey.prfOutput };
  if (!passkey.prfCapable) return null;
  const evaluated = await evaluatePrf([], rpId);
  return evaluated.prfOutput && evaluated.credentialId == credentialId
    ? { credentialId, prfOutput: evaluated.prfOutput }
    : null;
}

/**
 * Adds a passkey that unlocks new devices: it gets a wrap of the data key. A passkey without
 * PRF is refused before the server learns about it, so no useless passkey stays registered.
 * @throws {Error} With a German hint if the passkey cannot unlock.
 */
export async function addPasskey(context: KeyringContext): Promise<void> {
  const { challengeId, options } = await context.api.passkeyRegisterBegin();
  const passkey = await createPasskey(options).catch((error: unknown) => {
    if (error instanceof PasskeyExistsError) return null;
    throw error;
  });
  // Without the server's id the browser takes the page's host, which differs in the dev preview
  const rpId = options.rp.id;
  if (!passkey) return wrapExistingPasskey(context, rpId);
  const prf = await prfOf(passkey, rpId);
  if (!prf) throw new Error(NO_PRF);
  await context.api.passkeyRegisterFinish(challengeId, passkey.json, "");
  await addPasskeyWrap(context, prf);
}

/**
 * Sets up a passkey that already exists on this authenticator (e.g. added before PRF wraps
 * existed) for unlocking: the user picks it, its PRF output gets a wrap.
 */
async function wrapExistingPasskey(
  context: KeyringContext,
  rpId: string | undefined,
): Promise<void> {
  const { credentialId, prfOutput } = await evaluatePrf([], rpId);
  if (!prfOutput) throw new Error(NO_PRF);
  await addPasskeyWrap(context, { credentialId, prfOutput });
}

/** Unlocks the data key with any passkey of the account that has a wrap. */
export async function unlockWithPasskey(
  context: KeyringContext,
): Promise<void> {
  const [ids, { rpId }] = await Promise.all([
    passkeyWrapIds(context.api),
    context.api.session(),
  ]);
  if (!ids.length)
    throw new Error("Kein Passkey dieses Kontos kann die Daten entsperren.");
  // No list of credentials: with one, Chrome on Windows hands the request to Windows Hello
  // and never looks into the Google Password Manager. Without, it offers all its passkeys.
  const { credentialId, prfOutput } = await evaluatePrf([], rpId);
  if (!ids.includes(credentialId))
    throw new Error(
      "Dieser Passkey ist nicht zum Entsperren eingerichtet. Bitte einen anderen wählen oder das Gerät koppeln.",
    );
  if (!prfOutput)
    throw new Error("Dieser Passkey kann die Daten nicht entsperren.");
  await unlockWithPrf(context, { credentialId, prfOutput });
}
