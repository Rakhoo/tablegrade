import { Alert, Button } from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router";
import { formatSchoolYear } from "../../lib/formatters";
import { paths } from "../../lib/paths";
import { rememberReturnPage } from "../../lib/returnPage";

type MissingYearAlertProps = {
  /** The school years in use. */
  years: number[];
  /** The school year the new class would belong to. */
  year: number;
  /** Asks before the settings link leaves the page; calls `leave` to follow it. */
  onLeave?: (leave: () => void) => void;
  onUseExistingYear: () => void;
};

/**
 * Warning that the school year of a new class is not set up: it leads to the settings, or
 * creates the class in one of the existing school years instead.
 */
export function MissingYearAlert({
  years,
  year: presetYear,
  onLeave,
  onUseExistingYear,
}: MissingYearAlertProps) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <Alert severity="warning" className="mb-3">
      {years.length == 0
        ? "Es ist noch kein Schuljahr angelegt."
        : `Das Schuljahr ${formatSchoolYear(presetYear)} ist nicht angelegt.`}{" "}
      Bitte zuerst in den{" "}
      <Link
        to={paths.settings()}
        className="font-semibold underline"
        onClick={(event) => {
          const leave = () =>
            rememberReturnPage(paths.settings(), pathname + search);
          if (!onLeave) return leave();
          event.preventDefault();
          onLeave(() => {
            leave();
            navigate(paths.settings());
          });
        }}
      >
        Einstellungen
      </Link>{" "}
      hinzufügen.
      {years.length > 0 && (
        <div className="mt-2">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onUseExistingYear}
          >
            Stattdessen in einem bestehenden Schuljahr anlegen
          </Button>
        </div>
      )}
    </Alert>
  );
}
