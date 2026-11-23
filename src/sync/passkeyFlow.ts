/**
 * Passkey sign-up, sign-in and adding a passkey (plan B4): server challenge, browser dialog,
 * server check, then the data key via `keyring`.
 */
import type { SignInResult } from "./types";
import {
  addPasskeyWrap,
  completeSignIn,
  passkeyWrapIds,
  unlockWithPrf,
  type KeyringContext,
  type PrfResult,
} from "./keyring";
import {
  createPasskey,
  evaluatePrf,
  getPasskey,
  type PasskeyResult,
} from "./webauthn";

/**
 * PRF output of a passkey. Many authenticators report only `enabled` at registration; then a
 * second dialog evaluates PRF.
 */
async function prfOf(passkey: PasskeyResult): Promise<PrfResult | null> {
  const { credentialId } = passkey;
  if (passkey.prfOutput) return { credentialId, prfOutput: passkey.prfOutput };
  if (!passkey.prfCapable) return null;
  const evaluated = await evaluatePrf([credentialId]);
  return evaluated.prfOutput
    ? { credentialId, prfOutput: evaluated.prfOutput }
    : null;
}

/** Creates a new account with a passkey on this device. */
export async function passkeySignUp(
  context: KeyringContext,
  deviceName: string,
): Promise<SignInResult> {
  const { challengeId, options } = await context.api.passkeyRegisterBegin();
  const passkey = await createPasskey(options);
  const grant = await context.api.passkeyRegisterFinish(
    challengeId,
    passkey.json,
    deviceName,
  );
  if (!grant) throw new Error("Die Anmeldung ist fehlgeschlagen.");
  const prf = await prfOf(passkey);
  const { needsUnlock } = await completeSignIn(context, grant, prf);
  return { isNewUser: grant.isNewUser, needsUnlock };
}

/** Signs in with an existing passkey; its PRF output unlocks the data key if it has a wrap. */
export async function passkeySignIn(
  context: KeyringContext,
  deviceName: string,
): Promise<SignInResult> {
  const { challengeId, options } = await context.api.passkeyLoginBegin();
  const passkey = await getPasskey(options);
  const grant = await context.api.passkeyLoginFinish(
    challengeId,
    passkey.json,
    deviceName,
  );
  const prf = passkey.prfOutput
    ? { credentialId: passkey.credentialId, prfOutput: passkey.prfOutput }
    : null;
  const { needsUnlock } = await completeSignIn(context, grant, prf);
  return { isNewUser: grant.isNewUser, needsUnlock };
}

/**
 * Adds another passkey to the signed-in account. With PRF it also gets a wrap, so it can
 * unlock new devices. Returns whether it supports PRF.
 */
export async function addPasskey(context: KeyringContext): Promise<boolean> {
  const { challengeId, options } = await context.api.passkeyRegisterBegin();
  const passkey = await createPasskey(options);
  await context.api.passkeyRegisterFinish(challengeId, passkey.json, "");
  const prf = await prfOf(passkey);
  if (prf) await addPasskeyWrap(context, prf);
  return !!prf;
}

/** Unlocks the data key with any passkey of the account that has a wrap. */
export async function unlockWithPasskey(
  context: KeyringContext,
): Promise<void> {
  const ids = await passkeyWrapIds(context.api);
  if (!ids.length)
    throw new Error("Kein Passkey dieses Kontos kann die Daten entsperren.");
  const { credentialId, prfOutput } = await evaluatePrf(ids);
  if (!prfOutput)
    throw new Error("Dieser Passkey kann die Daten nicht entsperren.");
  await unlockWithPrf(context, { credentialId, prfOutput });
}
