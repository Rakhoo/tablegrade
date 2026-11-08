import { Button } from "@mui/material";
import { useLocation } from "react-router";
import { useGoBack } from "../hooks/useGoBack";
import { getReturnPage } from "../lib/returnPage";
import { ChevronLeftIcon } from "./icons";

/**
 * A real step back, named after the page this one was opened from (see `rememberReturnPage`).
 * Started on this page, it leads to `fallback`.
 */
export function ReturnButton({
  fallback,
  onBack,
}: {
  fallback: string;
  /** Asks first, e.g. about unsaved input; calls `goBack` to leave. */
  onBack?: (goBack: () => void) => void;
}) {
  const { pathname } = useLocation();
  const back = getReturnPage(pathname, fallback);
  const goBack = useGoBack(back.url);
  return (
    <Button
      startIcon={<ChevronLeftIcon />}
      className="pl-2"
      data-help={`Zurück zur vorherigen Seite (${back.name}).`}
      onClick={() => (onBack ? onBack(goBack) : goBack())}
    >
      {back.name}
    </Button>
  );
}
