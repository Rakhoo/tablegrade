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
import { createPasskey, evaluatePrf, type PasskeyResult } from "./webauthn";

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
