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
        loader: async () => {
          const today = new Date();
          const holidays: any[] = [];
          holidays.push(
            ...(await fetch(
              "https://www.mehr-schulferien.de/api/v2.1/cities/ahlen/periods?start_date=" +
                today.getFullYear() +
                "-01-01&end_date=" +
                (today.getFullYear() + 3) +
                "-12-31",
            )
              .then((value) => value.json())
              .then((value) =>
                value.data.map(
                  (data: {
                    id: number;
                    starts_on: string;
                    ends_on: string;
                  }) => {
                    const { id, starts_on, ends_on } = data;
                    return { id, starts_on, ends_on };
                  },
                ),
              )),
          );
          return { holidays };
        },
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
