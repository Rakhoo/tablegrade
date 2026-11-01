import { useRouteLoaderData } from "react-router";
import type { RootLoaderData } from "../rootLoader";

/** Returns the app settings, loaded once by the root route. */
export const useSettings = () =>
  (useRouteLoaderData("root") as RootLoaderData).settings;
