import { createHashRouter, redirect } from "react-router";
import { App } from "./App";
import { ClassroomPage } from "./features/classroom/ClassroomPage";
import { classroomLoader } from "./features/classroom/classroomLoader";
import { TimetablePage } from "./features/timetable/TimetablePage";
import { timetableLoader } from "./features/timetable/timetableLoader";

/** Hash based routes, so the static hosting needs no rewrite rules. */
export const router = createHashRouter([
  {
    path: "/",
    Component: App,
    children: [
      { index: true, loader: () => redirect("/timetable") },
      { path: "timetable", loader: timetableLoader, Component: TimetablePage },
      {
        path: "classes/new",
        loader: (args) => classroomLoader(args, "new"),
        Component: ClassroomPage,
      },
      {
        path: "classes/:id",
        loader: (args) => classroomLoader(args, "view"),
        Component: ClassroomPage,
      },
      {
        path: "classes/:id/edit",
        loader: (args) => classroomLoader(args, "edit"),
        Component: ClassroomPage,
      },
      {
        path: "404",
        element: <div className="p-4">Seite nicht gefunden</div>,
      },
      { path: "*", loader: () => redirect("/404") },
    ],
  },
]);
