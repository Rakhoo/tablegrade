import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import "./index.css";

// iOS Safari ignores `user-scalable=no` for pinch gestures, its gesture events can be blocked
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), {
    passive: false,
  });
}

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
