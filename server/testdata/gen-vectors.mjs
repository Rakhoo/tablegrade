// Generates vectors.json: shared test vectors for the sync protocol (docs/sync-plan/protocol.md).
// Run with `node server/testdata/gen-vectors.mjs`. All inputs derive from fixed labels, so the
// output is deterministic and must not change unless the protocol changes.
import { createECDH, webcrypto } from "node:crypto";
import { writeFileSync } from "node:fs";

const { subtle } = webcrypto;
const enc = new TextEncoder();
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Hex string of bytes. */
const hex = (b) => Buffer.from(b).toString("hex");
/** Base64url without padding. */
const b64u = (b) => Buffer.from(b).toString("base64url");
/** Concatenates byte arrays. */
const concat = (...parts) => Buffer.concat(parts.map((p) => Buffer.from(p)));

/** SHA-256 of bytes or a UTF-8 string. */
async function sha256(data) {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  return new Uint8Array(await subtle.digest("SHA-256", bytes));
}

/** Deterministic test bytes: the first `n` bytes of SHA-256("notenfeder/test/" + label). */
async function fixed(label, n) {
  return (await sha256(`notenfeder/test/${label}`)).slice(0, n);
}

/** Crockford Base32, MSB first, no padding (input length must be a multiple of 5 bits). */
function base32(bytes, bits = bytes.length * 8) {
  let out = "";
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  const total = bytes.length * 8;
  for (let i = 0; i < bits / 5; i++) {
    out += CROCKFORD[Number((acc >> BigInt(total - 5 * (i + 1))) & 31n)];
  }
  return out;
}

/** HKDF-SHA256 with an empty salt and 32 bytes output. */
async function hkdf(ikm, info) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: enc.encode(info),
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** HMAC-SHA256, truncated to 16 bytes. */
async function hmac16(keyBytes, data) {
  const key = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await subtle.sign("HMAC", key, data)).slice(0, 16);
}

/** AES-256-GCM, returns nonce ‖ ciphertext ‖ tag. */
async function seal(keyBytes, nonce, plaintext, aad) {
  const key = await subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: enc.encode(aad) },
    key,
    plaintext,
  );
  return concat(nonce, new Uint8Array(ct));
}

/** Recovery key text for 20 bytes. */
async function recoveryText(bytes) {
  const check = (
    await sha256(concat(enc.encode("notenfeder/recovery/v1"), bytes))
  ).slice(0, 3);
  const text = base32(bytes) + base32(check, 20);
  return text.match(/.{4}/g).join("-");
}

const userId = "3f1d7c2e-8b4a-4c6e-9f0a-1b2c3d4e5f60";
const dek = await fixed("dek", 32);
const idk = await hkdf(dek, "notenfeder/record-id/v1");

// Recovery keys
const recoveryCases = [];
for (const label of ["recovery-1", "recovery-2", "recovery-3"]) {
  const bytes = await fixed(label, 20);
  recoveryCases.push({
    bytesHex: hex(bytes),
    text: await recoveryText(bytes),
    kekHex: hex(await hkdf(bytes, "notenfeder/kek/recovery/v1")),
  });
}
const zero = new Uint8Array(20);
recoveryCases.push({
  bytesHex: hex(zero),
  text: await recoveryText(zero),
  kekHex: hex(await hkdf(zero, "notenfeder/kek/recovery/v1")),
});
const canonical = recoveryCases[0].text;
const plain = canonical.replaceAll("-", "");
/** Replaces the character at index `i`. */
const setAt = (s, i, c) => s.slice(0, i) + c + s.slice(i + 1);
// Second case contains both 0 and 1: write them as o, I and l like a person might.
const plain2 = recoveryCases[1].text.replaceAll("-", "");
let ambiguous = 0;
const lookalikes = plain2.replace(/[01]/g, (c) =>
  c === "0" ? "o" : ++ambiguous % 2 ? "I" : "l",
);
const normalization = [
  { input: canonical, normalized: plain },
  { input: plain.toLowerCase(), normalized: plain },
  { input: ` ${plain.match(/.{1,6}/g).join(" ")} `, normalized: plain },
  { input: lookalikes, normalized: plain2 },
  { input: plain.replaceAll("1", "l"), normalized: plain },
];
// Flip one data character so the check characters no longer match.
const flipped = setAt(plain, 5, plain[5] === "A" ? "B" : "A");
const invalid = [
  { input: flipped, reason: "checksum" },
  { input: plain.slice(0, 35), reason: "length" },
  { input: setAt(plain, 3, "U"), reason: "character" },
  { input: setAt(plain, 7, "*"), reason: "character" },
];

// Passkey PRF
const prfSalt = await sha256("notenfeder/prf/v1");
const prfOutput = await fixed("prf-output", 32);
const passkeyKek = await hkdf(prfOutput, "notenfeder/kek/passkey/v1");

// Wraps
const wraps = [];
for (const [kind, kek] of [
  ["passkey", passkeyKek],
  [
    "recovery",
    await hkdf(await fixed("recovery-1", 20), "notenfeder/kek/recovery/v1"),
  ],
]) {
  const nonce = await fixed(`wrap-nonce-${kind}`, 12);
  const aad = `notenfeder/wrap/v1/${kind}/${userId}`;
  wraps.push({
    kind,
    userId,
    kekHex: hex(kek),
    dekHex: hex(dek),
    nonceHex: hex(nonce),
    aad,
    wrapped: b64u(await seal(kek, nonce, dek, aad)),
  });
}

// Record IDs
const recordKeys = [
  ["Classes", ["8c1f2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b"]],
  [
    "Classes2Students",
    [
      "8c1f2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
      "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    ],
  ],
  [
    "ReportGrades",
    [
      "8c1f2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
      "2026-01-30",
      "half",
      "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    ],
  ],
  ["SchoolYears", [2026]],
  ["Settings", ["seatLayout"]],
  ["CancelledDays", ["2026-12-24"]],
];
const recordIds = [];
for (const [table, key] of recordKeys) {
  const input = `${table}|${key.join("|")}`;
  recordIds.push({
    table,
    key,
    input,
    id: b64u(await hmac16(idk, enc.encode(input))),
  });
}

// Records
const records = [];
const recordSamples = [
  {
    t: "Classes",
    k: ["8c1f2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b"],
    v: 23,
    row: {
      id: "8c1f2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
      name: "10b Mathe",
      year: 2026,
    },
  },
  { t: "SchoolYears", k: [2026], v: 23, row: null },
];
for (const [i, sample] of recordSamples.entries()) {
  const id = recordIds.find(
    (r) => r.table === sample.t && r.key[0] === sample.k[0],
  ).id;
  const plaintext = JSON.stringify(sample);
  const nonce = await fixed(`record-nonce-${i}`, 12);
  const aad = `notenfeder/record/v1/${userId}/${id}`;
  records.push({
    userId,
    id,
    nonceHex: hex(nonce),
    aad,
    plaintext,
    deleted: sample.row === null,
    ciphertext: b64u(await seal(dek, nonce, enc.encode(plaintext), aad)),
  });
}

// Blobs
const dataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg";
const dataBytes = enc.encode(dataUrl);
const dataHash = await sha256(dataBytes);
const blobId = b64u(await hmac16(idk, concat(enc.encode("blob|"), dataHash)));
const blobNonce = await fixed("blob-nonce", 12);
const blobAad = `notenfeder/blob/v1/${userId}/${blobId}`;
const blob = {
  userId,
  dataUrl,
  sha256Hex: hex(dataHash),
  blobId,
  nonceHex: hex(blobNonce),
  aad: blobAad,
  ciphertext: b64u(await seal(dek, blobNonce, dataBytes, blobAad)),
};

// Device link
/** Fixed P-256 key pair from a label. */
async function ecdhPair(label) {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(await fixed(label, 32));
  return ecdh;
}
const newDevice = await ecdhPair("link-new");
const oldDevice = await ecdhPair("link-old");
const pubNew = newDevice.getPublicKey();
const pubOld = oldDevice.getPublicKey();
const shared = oldDevice.computeSecret(pubNew);
const linkKek = await hkdf(shared, "notenfeder/link/v1");
const linkNonce = await fixed("link-nonce", 12);
const linkAad = `notenfeder/wrap/v1/link/${userId}`;
const digest = await sha256(concat(pubNew, pubOld));
const checkCode = String(
  new DataView(digest.buffer).getUint32(0) % 1_000_000,
).padStart(6, "0");
const linkCodeBytes = await fixed("link-code", 5);
const link = {
  userId,
  newPrivateHex: hex(newDevice.getPrivateKey()),
  newPublic: b64u(pubNew),
  oldPrivateHex: hex(oldDevice.getPrivateKey()),
  oldPublic: b64u(pubOld),
  sharedSecretHex: hex(shared),
  kekHex: hex(linkKek),
  dekHex: hex(dek),
  nonceHex: hex(linkNonce),
  aad: linkAad,
  wrapped: b64u(await seal(linkKek, linkNonce, dek, linkAad)),
  checkCode,
  linkCodeBytesHex: hex(linkCodeBytes),
  linkCode: base32(linkCodeBytes),
};

const vectors = {
  version: 1,
  _format:
    "Raw bytes as lowercase hex (*Hex). Wire values (ids, wrapped, ciphertext, public keys) as base64url without padding. See docs/sync-plan/protocol.md.",
  keys: {
    dekHex: hex(dek),
    idkInfo: "notenfeder/record-id/v1",
    idkHex: hex(idk),
    prfSaltHex: hex(prfSalt),
    prfOutputHex: hex(prfOutput),
    passkeyKekHex: hex(passkeyKek),
  },
  recoveryKey: { cases: recoveryCases, normalization, invalid },
  wraps,
  recordIds,
  records,
  blob,
  link,
};

writeFileSync(
  new URL("./vectors.json", import.meta.url),
  `${JSON.stringify(vectors, null, 2)}\n`,
);
