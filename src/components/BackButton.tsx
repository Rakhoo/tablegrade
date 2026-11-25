import { Button } from "@mui/material";
import { Link } from "react-router";
import {
  getLastMainPage,
  getRememberedMainPage,
  MAIN_PAGE_LABELS,
  type MainPage,
} from "../lib/mainPage";
import { ChevronLeftIcon } from "./icons";
import { paths } from "../lib/paths";

type BackButtonProps = {
  /** The main page it leads to; by default the one shown last (see `getLastMainPage`). */
  target?: MainPage;
  /** Overrides the URL of the timetable, e.g. with the week of the shown lesson. */
  timetableUrl?: string;
  /** Only the arrow, e.g. next to the speed dial in the side bar. */
  iconOnly?: boolean;
};

/** Leads to a main page, as it was last shown (e.g. the selected week). */
export function BackButton({
  target: page = getLastMainPage(),
  timetableUrl,
  iconOnly = false,
}: BackButtonProps) {
  const url =
    page == "timetable" && timetableUrl
      ? timetableUrl
      : (getRememberedMainPage(page)?.url ??
        (page == "timetable" ? paths.timetable() : paths.classes()));
  return (
    <Button
      component={Link}
      to={url}
      startIcon={<ChevronLeftIcon />}
      className={
        "pl-2 compact:h-10 compact:min-w-0 compact:px-2 " +
        (iconOnly ? "min-w-0 px-2" : "")
      }
      data-help={
        page == "timetable"
          ? "Zurück zum Stundenplan."
          : "Zurück zu den Übersichten aller Klassen."
      }
    >
      <span className={iconOnly ? "sr-only" : "compact:sr-only"}>
        {MAIN_PAGE_LABELS[page]}
      </span>
    </Button>
  );
}
