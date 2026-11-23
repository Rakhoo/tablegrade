import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fromBase32,
  fromBase64url,
  fromUtf8,
  toBase32,
  toBase64url,
  utf8,
  type Bytes,
} from "./encoding";
import {
  exportDataKey,
  generateDataKey,
  importDataKey,
  passkeyKek,
  prfSalt,
  recoveryKek,
  unwrapDataKey,
  wrapDataKey,
  type WrapKind,
} from "./keys";
import {
  deriveLinkKek,
  generateLinkKeyPair,
  exportPublicKey,
  linkCheckCode,
} from "./link";
import { hkdf, importAesKey } from "./primitives";
import {
  formatRecoveryKey,
  generateRecoveryBytes,
  normalizeRecoveryKey,
  parseRecoveryKey,
  RecoveryKeyError,
} from "./recoveryKey";
import {
  blobId,
  decryptBlob,
  decryptRecord,
  encryptBlob,
  encryptRecord,
  recordId,
  type RecordPlaintext,
} from "./records";

/** Wrap vector. */
type WrapVector = {
  kind: WrapKind;
  userId: string;
  kekHex: string;
  nonceHex: string;
  wrapped: string;
};

/** Shape of server/testdata/vectors.json, as far as these tests use it. */
type Vectors = {
  keys: Record<
    | "dekHex"
    | "idkInfo"
    | "idkHex"
    | "prfSaltHex"
    | "prfOutputHex"
    | "passkeyKekHex",
    string
  >;
  recoveryKey: {
    cases: { bytesHex: string; text: string; kekHex: string }[];
    normalization: { input: string; normalized: string }[];
    invalid: { input: string; reason: string }[];
  };
  wraps: WrapVector[];
  recordIds: { table: string; key: (string | number)[]; id: string }[];
  records: {
    userId: string;
    id: string;
    nonceHex: string;
    plaintext: string;
    ciphertext: string;
  }[];
  blob: Record<
    "userId" | "dataUrl" | "blobId" | "nonceHex" | "ciphertext",
    string
  >;
  link: Record<
    | "userId"
    | "newPrivateHex"
    | "newPublic"
    | "oldPrivateHex"
    | "oldPublic"
    | "dekHex"
    | "nonceHex"
    | "wrapped"
    | "checkCode"
    | "linkCodeBytesHex"
    | "linkCode",
    string
  >;
};

/** Shared test vectors of the protocol (server/testdata/gen-vectors.mjs). */
const vectors = JSON.parse(
  readFileSync(
    new URL("../../server/testdata/vectors.json", import.meta.url),
    "utf8",
  ),
) as Vectors;

/** Bytes from lowercase hex. */
function hex(text: string): Bytes {
  return new Uint8Array(text.match(/../g)!.map((pair) => parseInt(pair, 16)));
}

/** Lowercase hex of bytes. */
function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const dataKey = await importDataKey(hex(vectors.keys.dekHex));

describe("encoding", () => {
  it("round-trips base64url without padding", () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0x00, 0x01]);
    expect(toBase64url(bytes)).toBe("-_-_AAE");
    expect(fromBase64url("-_-_AAE")).toEqual(bytes);
  });

  it("round-trips Crockford Base32", () => {
    const bytes = hex(vectors.link.linkCodeBytesHex);
    expect(toBase32(bytes)).toBe(vectors.link.linkCode);
    expect(fromBase32(vectors.link.linkCode)).toEqual(bytes);
  });
});

describe("keys", () => {
  it("derives the IDK from the DEK", async () => {
    const idk = await hkdf(hex(vectors.keys.dekHex), vectors.keys.idkInfo);
    expect(toHex(idk)).toBe(vectors.keys.idkHex);
  });

  it("uses the fixed PRF salt", async () => {
    expect(toHex(await prfSalt())).toBe(vectors.keys.prfSaltHex);
  });

  it("derives the passkey KEK from the PRF output", async () => {
    const kek = await hkdf(
      hex(vectors.keys.prfOutputHex),
      "notenfeder/kek/passkey/v1",
    );
    expect(toHex(kek)).toBe(vectors.keys.passkeyKekHex);
  });

  it("exports the DEK bytes", async () => {
    expect(toHex(await exportDataKey(dataKey))).toBe(vectors.keys.dekHex);
  });

  it.each(vectors.wraps)("wraps and unwraps ($kind)", async (wrap) => {
    const kek = await importAesKey(hex(wrap.kekHex));
    const wrapped = await wrapDataKey(
      dataKey,
      kek,
      wrap.kind,
      wrap.userId,
      hex(wrap.nonceHex),
    );
    expect(toBase64url(wrapped)).toBe(wrap.wrapped);
    const unwrapped = await unwrapDataKey(
      fromBase64url(wrap.wrapped),
      kek,
      wrap.kind,
      wrap.userId,
    );
    expect(toHex(await exportDataKey(unwrapped))).toBe(vectors.keys.dekHex);
  });

  it("wraps with the passkey KEK from the PRF output", async () => {
    const wrap = vectors.wraps.find((w) => w.kind === "passkey")!;
    const kek = await passkeyKek(hex(vectors.keys.prfOutputHex));
    const unwrapped = await unwrapDataKey(
      fromBase64url(wrap.wrapped),
      kek,
      "passkey",
      wrap.userId,
    );
    expect(toHex(await exportDataKey(unwrapped))).toBe(vectors.keys.dekHex);
  });

  it("rejects a wrap of another user", async () => {
    const key = await generateDataKey();
    const kek = await recoveryKek(generateRecoveryBytes());
    const wrapped = await wrapDataKey(key, kek, "recovery", "user-a");
    await expect(
      unwrapDataKey(wrapped, kek, "recovery", "user-b"),
    ).rejects.toThrow();
  });
});

describe("recovery key", () => {
  it.each(vectors.recoveryKey.cases)(
    "formats and parses $text",
    async (item) => {
      expect(await formatRecoveryKey(hex(item.bytesHex))).toBe(item.text);
      expect(toHex(await parseRecoveryKey(item.text))).toBe(item.bytesHex);
      const kek = await hkdf(hex(item.bytesHex), "notenfeder/kek/recovery/v1");
      expect(toHex(kek)).toBe(item.kekHex);
    },
  );

  it.each(vectors.recoveryKey.normalization)("normalizes $input", (item) => {
    expect(normalizeRecoveryKey(item.input)).toBe(item.normalized);
  });

  it.each(vectors.recoveryKey.invalid)(
    "rejects $input ($reason)",
    async (item) => {
      const error = await parseRecoveryKey(item.input).catch((e) => e);
      expect(error).toBeInstanceOf(RecoveryKeyError);
      expect(error.problem).toBe(item.reason);
    },
  );

  it("reports a typo with the agreed message", async () => {
    const error = await parseRecoveryKey(
      vectors.recoveryKey.invalid[0].input,
    ).catch((e) => e);
    expect(error.message).toBe("Tippfehler im Schlüssel");
  });

  it("round-trips a new key", async () => {
    const bytes = generateRecoveryBytes();
    expect(await parseRecoveryKey(await formatRecoveryKey(bytes))).toEqual(
      bytes,
    );
  });
});

describe("records", () => {
  it.each(vectors.recordIds)(
    "computes the id of $input",
    async (item: { table: string; key: (string | number)[]; id: string }) => {
      expect(await recordId(dataKey, item.table, item.key)).toBe(item.id);
    },
  );

  it.each(vectors.records)("encrypts and decrypts record $id", async (item) => {
    const plaintext = JSON.parse(item.plaintext) as RecordPlaintext;
    const ciphertext = await encryptRecord(
      dataKey,
      item.userId,
      item.id,
      plaintext,
      hex(item.nonceHex),
    );
    expect(ciphertext).toBe(item.ciphertext);
    expect(
      await decryptRecord(dataKey, item.userId, item.id, item.ciphertext),
    ).toEqual(plaintext);
  });

  it("rejects a record moved to another id", async () => {
    const item = vectors.records[0];
    await expect(
      decryptRecord(dataKey, item.userId, "other", item.ciphertext),
    ).rejects.toThrow();
  });

  it("computes the blob id and encrypts the blob", async () => {
    const { blob } = vectors;
    expect(await blobId(dataKey, blob.dataUrl)).toBe(blob.blobId);
    const sealed = await encryptBlob(
      dataKey,
      blob.userId,
      blob.blobId,
      blob.dataUrl,
      hex(blob.nonceHex),
    );
    expect(toBase64url(sealed)).toBe(blob.ciphertext);
    expect(
      await decryptBlob(
        dataKey,
        blob.userId,
        blob.blobId,
        fromBase64url(blob.ciphertext),
      ),
    ).toBe(blob.dataUrl);
  });
});

describe("device link", () => {
  /** Imports a fixed P-256 private key from the vectors via JWK (raw import is not allowed). */
  async function privateKey(privateHex: string, publicB64: string) {
    const pub = fromBase64url(publicB64);
    return crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: toBase64url(hex(privateHex)),
        x: toBase64url(pub.subarray(1, 33)),
        y: toBase64url(pub.subarray(33)),
      },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  }

  it("derives the same KEK on both devices and unwraps the DEK", async () => {
    const { link } = vectors;
    const oldKey = await privateKey(link.oldPrivateHex, link.oldPublic);
    const newKey = await privateKey(link.newPrivateHex, link.newPublic);
    const oldKek = await deriveLinkKek(oldKey, fromBase64url(link.newPublic));
    const newKek = await deriveLinkKek(newKey, fromBase64url(link.oldPublic));
    const wrapped = await wrapDataKey(
      dataKey,
      oldKek,
      "link",
      link.userId,
      hex(link.nonceHex),
    );
    expect(toBase64url(wrapped)).toBe(link.wrapped);
    const unwrapped = await unwrapDataKey(wrapped, newKek, "link", link.userId);
    expect(toHex(await exportDataKey(unwrapped))).toBe(link.dekHex);
  });

  it("computes the check code", async () => {
    const { link } = vectors;
    expect(
      await linkCheckCode(
        fromBase64url(link.newPublic),
        fromBase64url(link.oldPublic),
      ),
    ).toBe(link.checkCode);
  });

  it("exports fresh public keys in raw form", async () => {
    const pair = await generateLinkKeyPair();
    const raw = await exportPublicKey(pair.publicKey);
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(4);
  });
});

describe("utf8", () => {
  it("round-trips umlauts", () => {
    expect(fromUtf8(utf8("Prüfung ß"))).toBe("Prüfung ß");
  });
});
