import { normalizeRecoveryKey } from "../crypto/recoveryKey";

/** Number of groups the user types back to show that the key was saved. */
const CHECK_COUNT = 2;

/** Splits a formatted recovery key (`K7QF-M2XA-…`) into its groups of four. */
export function recoveryKeyGroups(key: string): string[] {
  return key.split("-");
}

/**
 * Picks the positions (0-based, ascending) of two different groups that the user has to type
 * back. `random` returns values in [0, 1) like `Math.random`; tests pass a fixed one.
 */
export function pickCheckGroups(
  key: string,
  random: () => number = Math.random,
): number[] {
  const positions = recoveryKeyGroups(key).map((_, index) => index);
  const picked: number[] = [];
  while (picked.length < CHECK_COUNT && positions.length > 0) {
    const [position] = positions.splice(
      Math.floor(random() * positions.length),
      1,
    );
    picked.push(position);
  }
  return picked.sort((a, b) => a - b);
}

/**
 * Whether the typed text matches the group at `position`. Accepts any case, spaces and the
 * look-alike characters that the recovery key itself accepts (`O` for `0`, `I`/`L` for `1`).
 */
export function isGroupCorrect(
  key: string,
  position: number,
  typed: string,
): boolean {
  return normalizeRecoveryKey(typed) == recoveryKeyGroups(key)[position];
}
