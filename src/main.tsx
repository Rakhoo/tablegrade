import { createRoot } from "react-dom/client";
import { InstallPage } from "./features/install/InstallPage";
import { isLocalRun, isStandalone, resetLaunchUrl } from "./services/pwa";
import "./index.css";

// iOS Safari ignores `user-scalable=no` for pinch gestures, its gesture events can be blocked
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), {
    passive: false,
  });
}

const container = document.getElementById("root")!;

/**
 * Shows an error that stopped the app before or while rendering, instead of an empty page:
 * plain DOM, as React itself may be what failed. "Neu laden" also clears the offline copy of
 * the app, in case it is out of step with the server. The data on the device stays.
 */
function showFatalError(reason: unknown) {
  // Later, so React has finished removing a crashed tree first
  setTimeout(() => {
    if (container.childElementCount > 0) return;
    const box = document.createElement("div");
    box.style.cssText =
      "display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;height:100dvh;padding:24px;text-align:center;font-family:system-ui,sans-serif;color:#2b2540";
    const title = document.createElement("strong");
    title.textContent = "Notenfeder konnte nicht starten.";
    const detail = document.createElement("code");
    detail.style.cssText = "font-size:12px;word-break:break-word;opacity:.7";
    detail.textContent =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : String(reason);
    const button = document.createElement("button");
    button.textContent = "Neu laden";
    button.style.cssText =
      "padding:10px 20px;border-radius:999px;border:0;background:#7352d0;color:white;font-weight:600";
    button.onclick = async () => {
      const registrations = await navigator.serviceWorker?.getRegistrations();
      await Promise.all(registrations?.map((item) => item.unregister()) ?? []);
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
      location.reload();
    };
    box.append(title, detail, button);
    container.replaceChildren(box);
  });
}

window.addEventListener("error", (event) => showFatalError(event.error));
window.addEventListener("unhandledrejection", (event) =>
  showFatalError(event.reason),
);

const root = createRoot(container, {
  onUncaughtError: (error) => showFatalError(error),
});

/** Time after which a start that shows nothing yet counts as stuck. */
const START_TIMEOUT_MS = 15000;

/**
 * Starts the app. Loaded on demand, so a browser tab never opens the database. A start that
 * hangs before the first screen, e.g. on an outdated offline copy, shows the error screen.
 */
async function startApp() {
  setTimeout(
    () =>
      showFatalError(
        new Error("Der Start hängt (keine Anzeige nach 15 Sekunden)."),
      ),
    START_TIMEOUT_MS,
  );
  const [{ createAppRouter }, { RouterProvider }, { restoreOidcRoute }] =
    await Promise.all([
      import("./router"),
      import("react-router/dom"),
      import("./sync"),
    ]);
  restoreOidcRoute();
  root.render(<RouterProvider router={createAppRouter()} />);
}

if (isStandalone()) {
  resetLaunchUrl();
  startApp().catch(showFatalError);
} else if (isLocalRun()) {
  startApp().catch(showFatalError);
} else {
  // The clean base URL is what gets installed; in the app it leads to the timetable
  history.replaceState(null, "", "/");
  root.render(<InstallPage />);
}
