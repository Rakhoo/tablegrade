import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { createAppRouter } from "./router";
import { resetLaunchUrl } from "./services/pwa";
import "./index.css";

// iOS Safari ignores `user-scalable=no` for pinch gestures, its gesture events can be blocked
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), {
    passive: false,
  });
}

resetLaunchUrl();

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={createAppRouter()} />,
);
