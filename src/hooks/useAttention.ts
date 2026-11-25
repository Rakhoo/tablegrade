import { useRouteLoaderData } from "react-router";
import { getAttention, type Attention } from "../lib/attention";
import type { RootLoaderData } from "../rootLoader";
import { useSyncStatus } from "./useSyncStatus";

/** Open points of the setup (sync, school year) for the hints in menu and settings. */
export function useAttention(): Attention[] {
  const { schoolYears } = useRouteLoaderData("root") as RootLoaderData;
  return getAttention({
    sync: useSyncStatus(),
    schoolYearCount: schoolYears.length,
  });
}
