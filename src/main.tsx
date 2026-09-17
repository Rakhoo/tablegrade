import { createRoot } from "react-dom/client";
import { createHashRouter, redirect } from "react-router";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import App from "./components/app";
import Calendar from "./components/calendar";

const router = createHashRouter([
  {
    path: "/",
    Component: App,
    children: [
      {
        path: "/",
        loader: () => redirect("calendar"),
      },
      {
        path: "calendar",
        Component: Calendar,
      },
      {
        path: "*",
        element: <div>Error</div>,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
