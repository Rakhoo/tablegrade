import { createHashRouter, redirect } from "react-router";
import { App } from "./App";
import { ErrorPage } from "./features/errors/ErrorPage";
import { ClassroomPage } from "./features/classroom/ClassroomPage";
import { classroomLoader } from "./features/classroom/classroomLoader";
import { TimetablePage } from "./features/timetable/TimetablePage";
import { timetableLoader } from "./features/timetable/timetableLoader";

/**
 * Creates the hash based router, so the static hosting needs no rewrite rules.
 * A function instead of a module constant, so the launch URL can be reset before it is read.
 */
export const createAppRouter = () =>
  createHashRouter([
    {
      path: "/",
      Component: App,
      children: [
        {
          // Errors render inside App, so they keep the theme and layout
          ErrorBoundary: ErrorPage,
          children: [
            { index: true, loader: () => redirect("/timetable") },
            {
              path: "timetable",
              loader: timetableLoader,
              // The loaded data does not depend on the selected week (`?date=`)
              shouldRevalidate: ({
                currentUrl,
                nextUrl,
                defaultShouldRevalidate,
              }) =>
                currentUrl.pathname == nextUrl.pathname &&
                currentUrl.search != nextUrl.search
                  ? false
                  : defaultShouldRevalidate,
              Component: TimetablePage,
            },
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
            { path: "404", Component: ErrorPage },
            { path: "*", loader: () => redirect("/404") },
          ],
        },
      ],
    },
  ]);
