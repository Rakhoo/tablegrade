/**
 * Recovery key text (protocol.md section 3): 32 Crockford Base32 characters of 20 random bytes
 * plus 4 check characters, shown in groups of four.
 */
import {
  CROCKFORD,
  concat,
  fromBase32,
  toBase32,
  utf8,
  type Bytes,
} from "./encoding";
import { randomBytes, sha256 } from "./primitives";

const KEY_BYTES = 20;
const DATA_CHARS = 32;
const TEXT_LENGTH = 36;

/** Why a typed recovery key is invalid. */
export type RecoveryKeyProblem = "length" | "character" | "checksum";

/** Error for a typed recovery key, with a German message for the UI. */
export class RecoveryKeyError extends Error {
  /** What is wrong; lets callers react without parsing the message. */
  readonly problem: RecoveryKeyProblem;

  constructor(problem: RecoveryKeyProblem, message: string) {
    super(message);
    this.name = "RecoveryKeyError";
    this.problem = problem;
  }
}

/** The 4 check characters: first 20 bits of `SHA-256(label ‖ bytes)`. */
async function checkChars(bytes: Bytes): Promise<string> {
  const digest = await sha256(concat(utf8("notenfeder/recovery/v1"), bytes));
  return toBase32(digest.subarray(0, 3), 20);
}

/** Creates 20 new random recovery key bytes. */
export function generateRecoveryBytes(): Bytes {
  return randomBytes(KEY_BYTES);
}

/** Formats recovery key bytes as text in groups of four, e.g. `K7QF-M2XA-…`. */
export async function formatRecoveryKey(bytes: Bytes): Promise<string> {
  const text = toBase32(bytes) + (await checkChars(bytes));
  // The text always has 36 characters, so the match is never null
  return text.match(/.{4}/g)!.join("-");
}

/**
 * Normalizes typed input: drops spaces and dashes, upper case, `O`→`0`, `I`/`L`→`1`. Does not
 * validate.
 */
export function normalizeRecoveryKey(input: string): string {
  return input
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/**
 * Parses a typed recovery key into its 20 bytes. Throws `RecoveryKeyError` on a wrong length,
 * an invalid character or a typo (checksum), without asking the server.
 */
export async function parseRecoveryKey(input: string): Promise<Bytes> {
  const text = normalizeRecoveryKey(input);
  const invalid = [...text].find((char) => !CROCKFORD.includes(char));
  if (invalid) {
    throw new RecoveryKeyError(
      "character",
      `Das Zeichen „${invalid}“ kommt im Schlüssel nicht vor.`,
    );
  }
  if (text.length !== TEXT_LENGTH) {
    throw new RecoveryKeyError(
      "length",
      `Der Schlüssel hat ${TEXT_LENGTH} Zeichen, eingegeben sind ${text.length}.`,
    );
  }
  const bytes = fromBase32(text.slice(0, DATA_CHARS));
  if ((await checkChars(bytes)) !== text.slice(DATA_CHARS)) {
    throw new RecoveryKeyError("checksum", "Tippfehler im Schlüssel");
  }
  return bytes;
}
