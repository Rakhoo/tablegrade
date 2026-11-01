import {
  getSchoolYears,
  getSettings,
  isDatabasePersistent,
  waitForDatabase,
} from "./db";

/** Remembers the automatic retry, so a lasting failure does not reload forever. */
const RETRY_KEY = "storageRetry";

/**
 * Makes sure the data is stored on the device. A failed start can be temporary, for example a
 * slow start of the storage worker, so it is retried once by reloading.
 * @returns `false` if the storage stays unavailable.
 */
async function ensurePersistentStorage() {
  if (await isDatabasePersistent()) {
    sessionStorage.removeItem(RETRY_KEY);
    // Asks the browser not to delete the data when disk space runs low
    await navigator.storage.persist?.().catch(() => false);
    return true;
  }
  if (sessionStorage.getItem(RETRY_KEY)) return false;
  sessionStorage.setItem(RETRY_KEY, "1");
  window.location.reload();
  // The reload takes over, nothing else may run on the temporary database
  return new Promise<boolean>(() => undefined);
}

/** Loads what every page needs: the settings and the school years in use. */
export async function rootLoader() {
  await waitForDatabase();
  const persistent = await ensurePersistentStorage();
  const [settings, schoolYears] = await Promise.all([
    getSettings(),
    getSchoolYears(),
  ]);
  return { settings, schoolYears, persistent };
}

export type RootLoaderData = Awaited<ReturnType<typeof rootLoader>>;
