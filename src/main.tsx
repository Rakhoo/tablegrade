import { createRoot } from "react-dom/client";
import { createHashRouter, redirect } from "react-router";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import App from "./components/app";
import Calendar from "./components/calendar";
import { db, holidays } from "./db";

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
          const holidaysArr: any[] = await db.select().from(holidays);
          if (
            holidaysArr.length == 0 ||
            !holidaysArr.find((holiday) =>
              holiday.end.startsWith(today.getFullYear() + 2),
            )
          ) {
            holidaysArr.push(
              ...(await fetch(
                "https://www.mehr-schulferien.de/api/v2.1/cities/ahlen/periods?start_date=" +
                  today.getFullYear() +
                  "-01-01&end_date=" +
                  (today.getFullYear() + 2) +
                  "-12-31",
              )
                .then((value) => value.json())
                .then((value) =>
                  value.data.map(
                    (data: {
                      id: number;
                      starts_on: string;
                      ends_on: string;
                      name: string;
                    }) => {
                      const { id, starts_on: start, ends_on: end, name } = data;
                      return { id, start, end, summer: name == "Sommer" };
                    },
                  ),
                )),
            );
            for (let holiday of holidaysArr.filter(
              (value, index, arr) =>
                !arr.find((val, ind) => val.id == value.id && ind != index),
            )) {
              await db.insert(holidays).values(holiday).execute();
            }
          }
          return { holidays: holidaysArr };
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
