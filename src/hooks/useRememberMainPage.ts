import { useEffect } from "react";
import { useLocation } from "react-router";
import { rememberMainPage, type MainPage } from "../lib/mainPage";
import { resetEditHistory } from "./useEditHistory";

/**
 * Remembers this main page with its URL, so the pages of a class lead back to it. The undo
 * history of the classes ends here, as the main pages change data as well.
 */
export function useRememberMainPage(page: MainPage) {
  const { pathname, search } = useLocation();
  useEffect(
    () => rememberMainPage(page, pathname + search),
    [page, pathname, search],
  );
  useEffect(resetEditHistory, []);
}
