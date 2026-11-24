/**
 * Passkeys with `navigator.credentials` and the PRF extension (plan B4). Converts the JSON
 * options of the server by hand, because older Safari versions lack
 * `PublicKeyCredential.parseCreationOptionsFromJSON` and `toJSON()`.
 */
import { fromBase64url, toBase64url, type Bytes } from "../crypto/encoding";
import { prfSalt } from "../crypto/keys";

/** Credential descriptor as JSON. */
type DescriptorJson = { id: string; type: string; transports?: string[] };

/** Decodes the ids of credential descriptors. */
function descriptors(
  list: DescriptorJson[] | undefined,
): PublicKeyCredentialDescriptor[] | undefined {
  return list?.map((item) => ({
    ...item,
    type: "public-key",
    id: fromBase64url(item.id),
    transports: item.transports as AuthenticatorTransport[] | undefined,
  }));
}

/** Creation options from server JSON, with the PRF extension for the fixed salt. */
export async function creationOptions(
  json: PublicKeyCredentialCreationOptionsJSON,
): Promise<PublicKeyCredentialCreationOptions> {
  return {
    ...(json as unknown as PublicKeyCredentialCreationOptions),
    challenge: fromBase64url(json.challenge),
    user: { ...json.user, id: fromBase64url(json.user.id) },
    excludeCredentials: descriptors(json.excludeCredentials),
    extensions: {
      ...(json.extensions as AuthenticationExtensionsClientInputs),
      prf: { eval: { first: await prfSalt() } },
    },
  };
}

/** Request options from server JSON (or a local challenge), with the PRF extension. */
export async function requestOptions(
  json: PublicKeyCredentialRequestOptionsJSON,
): Promise<PublicKeyCredentialRequestOptions> {
  return {
    ...(json as unknown as PublicKeyCredentialRequestOptions),
    challenge: fromBase64url(json.challenge),
    allowCredentials: descriptors(json.allowCredentials),
    extensions: {
      ...(json.extensions as AuthenticationExtensionsClientInputs),
      prf: { eval: { first: await prfSalt() } },
    },
  };
}

/** Encodes a binary field if present. */
const encode = (buffer: ArrayBuffer | null | undefined) =>
  buffer ? toBase64url(new Uint8Array(buffer)) : undefined;

/** JSON form of a credential as the server expects it (like `toJSON()`). */
export function credentialJson(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse &
    AuthenticatorAssertionResponse;
  const extensions = credential.getClientExtensionResults();
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: {
      // The PRF output is a secret for the KEK and never leaves the device
      ...(extensions.prf && { prf: { enabled: extensions.prf.enabled } }),
    },
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      attestationObject: encode(response.attestationObject),
      transports: response.getTransports?.(),
      authenticatorData: encode(response.authenticatorData),
      signature: encode(response.signature),
      userHandle: encode(response.userHandle),
    },
  };
}

/** Outcome of a passkey ceremony relevant for the data key. */
export type PasskeyResult = {
  /** The credential, ready to send to the server. */
  json: ReturnType<typeof credentialJson>;
  /** Credential id, Base64url. */
  credentialId: string;
  /** Whether the passkey supports PRF (reported at registration). */
  prfCapable: boolean;
  /** PRF output for the fixed salt; missing if the authenticator gave none. */
  prfOutput: Bytes | null;
};

/** Collects id, PRF support and PRF output of a credential. */
function result(credential: PublicKeyCredential): PasskeyResult {
  const prf = credential.getClientExtensionResults().prf;
  const first = prf?.results?.first;
  return {
    json: credentialJson(credential),
    credentialId: credential.id,
    prfCapable: !!prf?.enabled || !!first,
    prfOutput: first
      ? new Uint8Array(
          first instanceof ArrayBuffer ? first : (first as Uint8Array).slice(),
        )
      : null,
  };
}

/** German message for a cancelled or failed passkey dialog. */
/** The authenticator already holds a passkey of this account (excluded at registration). */
export class PasskeyExistsError extends Error {
  constructor() {
    super("Dieser Passkey ist schon eingerichtet.");
  }
}

function passkeyError(error: unknown): Error {
  const name = (error as Error)?.name;
  if (name == "NotAllowedError")
    return new Error("Der Passkey-Dialog wurde abgebrochen.");
  if (name == "InvalidStateError") return new PasskeyExistsError();
  return new Error("Der Passkey konnte nicht verwendet werden.");
}

/** Creates a passkey; asks for PRF in the same step. */
export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<PasskeyResult> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: await creationOptions(options),
    })) as PublicKeyCredential;
    return result(credential);
  } catch (error) {
    throw passkeyError(error);
  }
}

/** Uses a passkey for the local PRF evaluation. */
async function getPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<PasskeyResult> {
  try {
    const credential = (await navigator.credentials.get({
      publicKey: await requestOptions(options),
    })) as PublicKeyCredential;
    return result(credential);
  } catch (error) {
    throw passkeyError(error);
  }
}

/**
 * Gets the PRF output of one of the given passkeys without the server; the challenge is local,
 * because only the PRF output matters here, not a login.
 */
export function evaluatePrf(
  credentialIds: string[],
  rpId?: string,
): Promise<PasskeyResult> {
  return getPasskey({
    challenge: toBase64url(crypto.getRandomValues(new Uint8Array(32))),
    rpId,
    allowCredentials: credentialIds.map((id) => ({ id, type: "public-key" })),
    userVerification: "required",
  });
}
