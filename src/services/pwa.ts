/** The browser's deferred install prompt (Chromium only), captured as early as possible. */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

let installPrompt: InstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
});
window.addEventListener("appinstalled", () => (installPrompt = null));

/** Whether the app runs as an installed PWA instead of a browser tab. */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone == true;

/**
 * Lets a freshly launched installed app always start on the clean timetable. iPadOS may keep
 * the URL from the moment the app was added to the home screen instead of the manifest's
 * `start_url`. Reloads (update banner, "Neu laden") keep the current page.
 */
export function resetLaunchUrl() {
  const [navigation] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  if (isStandalone() && navigation?.type != "reload") {
    history.replaceState(null, "", "/#/timetable");
  }
}

/** Platform the install instructions are written for. */
export type InstallPlatform =
  | "installed"
  | "prompt"
  | "ios"
  | "ios-other-browser"
  | "mac-safari"
  | "android"
  | "desktop"
  | "unsupported";

/** Detects how this device can install the app. */
export function getInstallPlatform(): InstallPlatform {
  if (isStandalone()) return "installed";
  if (installPrompt) return "prompt";
  const agent = navigator.userAgent;
  // iPadOS reports itself as a Mac, but with touch support
  const isIos =
    /iPad|iPhone|iPod/.test(agent) ||
    (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  if (isIos)
    return /CriOS|FxiOS|EdgiOS/.test(agent) ? "ios-other-browser" : "ios";
  if (
    /Macintosh/.test(agent) &&
    /Safari/.test(agent) &&
    !/Chrome|Chromium|Edg/.test(agent)
  )
    return "mac-safari";
  if (/Android/.test(agent)) return "android";
  if (/Chrome|Chromium|Edg/.test(agent)) return "desktop";
  return "unsupported";
}

/** Shows the browser's own install dialog (only for the platform "prompt"). */
export async function promptInstall() {
  await installPrompt?.prompt();
  installPrompt = null;
}

/**
 * Reloads the app. A newer version that is already downloaded but still waiting gets
 * activated first, like the update banner does.
 */
export async function reloadApp() {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update().catch(() => undefined);
  if (registration?.waiting) {
    navigator.serviceWorker.addEventListener("controllerchange", () =>
      window.location.reload(),
    );
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
}
