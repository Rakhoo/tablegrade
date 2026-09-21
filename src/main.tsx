import { eq, getTableColumns } from "drizzle-orm";
import { createRoot } from "react-dom/client";
import { createHashRouter, redirect } from "react-router";
import { RouterProvider } from "react-router/dom";
import App from "./components/app";
import Calendar from "./components/calendar";
import Class from "./components/class";
import {
  classes,
  classes2Students,
  db,
  dbDone,
  holidays,
  students,
} from "./db";
import "./index.css";

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
          await dbDone();
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
        path: "class/:id?/:mode?",
        loader: async ({ params }) => {
          await dbDone();
          const data: {
            class: typeof classes.$inferSelect | undefined;
            students: (typeof students.$inferSelect)[];
          } = {
            class: undefined,
            students: [],
          };
          const realParams =
            params.id == "new" ? { id: undefined, mode: params.id } : params;
          if (
            (realParams.mode && !/^new|edit$/.test(realParams.mode)) ||
            (realParams.mode == "edit" && !realParams.id)
          )
            return redirect("/404");
          if (realParams.mode == "edit") {
            const dbClass = await db
              .select()
              .from(classes)
              .where(eq(classes.id, parseInt(realParams.id!)))
              .execute();
            if (dbClass && dbClass[0]) {
              data.class = dbClass[0];
              data.students = await db
                .select(getTableColumns(students))
                .from(students)
                .leftJoin(
                  classes2Students,
                  eq(students.id, classes2Students.studentId),
                )
                .where(eq(classes2Students.classId, parseInt(realParams.id!)))
                .execute();
            }
          }

          return { ...realParams, ...data };
        },
        Component: Class,
      },
      {
        path: "404",
        element: <div>Error</div>,
      },
      { path: "*", loader: () => redirect("/404") },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
