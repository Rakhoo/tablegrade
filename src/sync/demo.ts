import { OFF_STATUS, readStatus, updateStatus } from "./status";
import type {
  AccountInfo,
  Device,
  DeviceLinkApproval,
  OidcProvider,
  PendingDeviceLink,
  SignInResult,
} from "./types";

/** Simulated network delay, so loading states show up in the UI. */
const DELAY_MS = 600;
/** Recovery key from the test vectors, so it passes the real check later. */
const RECOVERY_KEY = "AMZ7-1YWK-S1GM-ZYJY-RV3Z-HHN4-5JVH-1PFY-AS31";

const now = Date.now();
/** Sample devices; revocations change this list for the session. */
let devices: Device[] = [
  {
    id: "d0000000-0000-4000-8000-000000000001",
    name: "iPad Schule",
    createdAt: now - 30 * 86_400_000,
    lastSeenAt: now,
    revokedAt: null,
    current: true,
  },
  {
    id: "d0000000-0000-4000-8000-000000000002",
    name: "PC Zuhause",
    createdAt: now - 10 * 86_400_000,
    lastSeenAt: now - 2 * 3_600_000,
    revokedAt: null,
    current: false,
  },
];

/** Waits like a network call would. */
function wait() {
  return new Promise<void>((resolve) => setTimeout(resolve, DELAY_MS));
}

/** Marks the device as signed in to the sample account under the given device name. */
async function signIn(
  isNewUser: boolean,
  deviceName: string,
): Promise<SignInResult> {
  await wait();
  devices = devices.map((d) => (d.current ? { ...d, name: deviceName } : d));
  updateStatus({
    phase: "locked",
    account: {
      userId: "a0000000-0000-4000-8000-000000000001",
      deviceId: devices[0].id,
      identities: [{ provider: "passkey", createdAt: now - 30 * 86_400_000 }],
      hasDataKey: !isNewUser,
      hasPrfPasskey: !isNewUser,
    },
  });
  return { isNewUser, needsUnlock: !isNewUser };
}

/** Merges `change` into the signed-in sample account. */
function updateAccount(change: Partial<AccountInfo>) {
  const { account } = readStatus();
  if (account) updateStatus({ account: { ...account, ...change } });
}

/** Marks the device as unlocked and synced. */
async function unlock() {
  await wait();
  updateStatus({ phase: "idle", lastSyncAt: Date.now(), error: null });
}

/**
 * Fake implementation of the facade with fixed sample values, so the UI can be built before
 * the real engine exists. Enabled with `VITE_SYNC_DEMO=true` at build time.
 */
export const demo = {
  enableSync: async () => {
    await wait();
    updateStatus({ phase: "signedOut" });
  },
  disableSync: async () => {
    await wait();
    updateStatus(OFF_STATUS);
  },
  startPasskeySignup: (deviceName: string) => signIn(true, deviceName),
  loginWithPasskey: (deviceName: string) => signIn(false, deviceName),
  startOidcLogin: async (provider: OidcProvider, deviceName: string) => {
    console.info(`Demo: OIDC login with ${provider}`);
    await signIn(false, deviceName);
  },
  unlockWithPasskey: unlock,
  unlockWithRecoveryKey: async (text: string) => {
    if (text.replace(/[\s-]/g, "").length != 36)
      throw new Error("Tippfehler im Schlüssel");
    await unlock();
  },
  createRecoveryKey: async () => {
    await wait();
    if (readStatus().phase == "locked")
      updateStatus({ phase: "idle", lastSyncAt: Date.now() });
    updateAccount({ hasDataKey: true });
    return RECOVERY_KEY;
  },
  addPasskey: async () => {
    await wait();
    updateAccount({ hasPrfPasskey: true });
  },
  startDeviceLink: async (): Promise<PendingDeviceLink> => {
    await wait();
    return {
      code: "9BDQ65XC",
      checkCode: wait().then(() => "093473"),
      accept: unlock,
      cancel: () => {},
    };
  },
  confirmDeviceLink: async (code: string): Promise<DeviceLinkApproval> => {
    await wait();
    if (code.length != 8) throw new Error("Code ungültig oder abgelaufen");
    return { checkCode: "093473", approve: wait };
  },
  listDevices: async () => {
    await wait();
    return devices;
  },
  revokeDevice: async (id: string) => {
    await wait();
    devices = devices.map((d) =>
      d.id == id ? { ...d, revokedAt: Date.now() } : d,
    );
  },
  syncNow: async () => {
    updateStatus({ phase: "syncing" });
    await wait();
    updateStatus({ phase: "idle", lastSyncAt: Date.now(), pending: 0 });
  },
  logout: async () => {
    await wait();
    updateStatus({ phase: "signedOut", account: null });
  },
  deleteAccount: async () => {
    await wait();
    updateStatus(OFF_STATUS);
  },
};
