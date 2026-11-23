import type { Bytes } from "../crypto/encoding";
import type { Api, IncomingRecord, OutgoingRecord } from "../sync/api";

/** Server records and blobs of one account in memory, as in protocol.md 4 and 5. */
export function createFakeServer() {
  const records = new Map<string, IncomingRecord>();
  const blobs = new Map<string, Bytes>();
  let seq = 0;
  let blobUploads = 0;

  /** Stores pushed records; the newest always wins (Last Write Wins). */
  const push = (deviceId: string, list: OutgoingRecord[]) =>
    list.map(({ id, deleted, schema, ciphertext }) => {
      const record = {
        id,
        seq: ++seq,
        updatedAt: Date.now(),
        deleted,
        schema,
        ciphertext,
        deviceId,
      };
      records.set(id, record);
      return { id, seq: record.seq, updatedAt: record.updatedAt };
    });

  /** Records after `after`, ascending. */
  const pull = (after: number, limit = 500) => {
    const newer = [...records.values()]
      .filter((record) => record.seq > after)
      .sort((a, b) => a.seq - b.seq);
    return {
      records: newer.slice(0, limit),
      more: newer.length > limit,
      latestSeq: seq,
    };
  };

  return {
    records,
    /** Number of blob uploads so far, including repeated ones. */
    blobUploads: () => blobUploads,
    /** API client of one device; only the sync calls exist. */
    api: (deviceId: string) =>
      ({
        push: async (list: OutgoingRecord[]) => push(deviceId, list),
        pull: async (after: number, limit?: number) => pull(after, limit),
        putBlob: async (id: string, bytes: Bytes) => {
          blobUploads++;
          blobs.set(id, bytes);
        },
        getBlob: async (id: string) => blobs.get(id)!,
      }) as unknown as Api,
  };
}
