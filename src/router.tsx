import { createHashRouter, redirect } from "react-router";
import { App } from "./App";
import { StartupScreen } from "./components/brand/StartupScreen";
import { paths } from "./lib/paths";
import { rootLoader } from "./rootLoader";
import { ErrorPage } from "./features/errors/ErrorPage";
import { ClassEditPage } from "./features/classEdit/ClassEditPage";
import { classEditLoader } from "./features/classEdit/classEditLoader";
import { ClassroomPage } from "./features/classroom/ClassroomPage";
import { classroomLoader } from "./features/classroom/classroomLoader";
import { NameTrainerPage } from "./features/nameTrainer/NameTrainerPage";
import { nameTrainerLoader } from "./features/nameTrainer/nameTrainerLoader";
import { OverviewPage } from "./features/overview/OverviewPage";
import { overviewLoader } from "./features/overview/overviewLoader";
import { ClassListPage } from "./features/classList/ClassListPage";
import { classListLoader } from "./features/classList/classListLoader";
import { SettingsPage } from "./features/settings/SettingsPage";
import { settingsLoader } from "./features/settings/settingsLoader";
import { TimetablePage } from "./features/timetable/TimetablePage";
import { timetableLoader } from "./features/timetable/timetableLoader";

/**
 * Creates the hash based router, so the static hosting needs no rewrite rules.
 * A function instead of a module constant, so the launch URL can be reset before it is read.
 */
export const createAppRouter = () =>
  createHashRouter([
    {
      id: "root",
      path: "/",
      loader: rootLoader,
      Component: App,
      // The first loaders wait for the database, which may take a moment on start
      HydrateFallback: StartupScreen,
      children: [
        {
          // Errors render inside App, so they keep the theme and layout
          ErrorBoundary: ErrorPage,
          children: [
            { index: true, loader: () => redirect(paths.timetable()) },
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
              path: "classes",
              loader: classListLoader,
              Component: ClassListPage,
            },
            {
              path: "classes/new",
              loader: classEditLoader,
              Component: ClassEditPage,
            },
            {
              path: "classes/:id",
              loader: classroomLoader,
              Component: ClassroomPage,
            },
            {
              path: "classes/:id/table",
              loader: overviewLoader,
              Component: OverviewPage,
            },
            {
              path: "classes/:id/edit",
              loader: classEditLoader,
              Component: ClassEditPage,
            },
            {
              path: "classes/:id/names",
              loader: nameTrainerLoader,
              Component: NameTrainerPage,
            },
            {
              path: "settings",
              loader: settingsLoader,
              Component: SettingsPage,
            },
            { path: "404", Component: ErrorPage },
            { path: "*", loader: () => redirect(paths.notFound()) },
          ],
        },
      ],
    },
  ]);
