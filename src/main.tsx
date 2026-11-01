import { createRoot } from "react-dom/client";
import { InstallPage } from "./features/install/InstallPage";
import { isStandalone, resetLaunchUrl } from "./services/pwa";
import "./index.css";

// iOS Safari ignores `user-scalable=no` for pinch gestures, its gesture events can be blocked
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), {
    passive: false,
  });
}

const root = createRoot(document.getElementById("root")!);

/** Starts the app. Loaded on demand, so a browser tab never opens the database. */
async function startApp() {
  const [{ createAppRouter }, { RouterProvider }] = await Promise.all([
    import("./router"),
    import("react-router/dom"),
  ]);
  root.render(<RouterProvider router={createAppRouter()} />);
}

if (isStandalone()) {
  resetLaunchUrl();
  startApp();
} else if (import.meta.env.DEV) {
  // Development runs in a normal browser tab
  startApp();
} else {
  // The clean base URL is what gets installed; in the app it leads to the timetable
  history.replaceState(null, "", "/");
  root.render(<InstallPage />);
}
