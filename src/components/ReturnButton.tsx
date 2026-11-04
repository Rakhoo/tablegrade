import { Button } from "@mui/material";
import { useLocation, useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const back = getReturnPage(pathname, fallback);
  return (
    <Button
      startIcon={<ChevronLeftIcon />}
      className="pl-2"
      data-help={`Zurück zur vorherigen Seite (${back.name}).`}
      onClick={() => {
        const goBack = () => {
          // A real step back keeps the scroll position and history of that page
          if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
          else navigate(back.url, { replace: true });
        };
        if (onBack) onBack(goBack);
        else goBack();
      }}
    >
      {back.name}
    </Button>
  );
}
