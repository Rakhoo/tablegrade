import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import App from "./App.tsx";

const router = createHashRouter([
  {
    path: "/",
    Component: App,
    children: [
      {
        path: "/calendar",
        element: <div>AAAAAH</div>,
      },{
        path: "*",
        element: <div>Error</div>,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
