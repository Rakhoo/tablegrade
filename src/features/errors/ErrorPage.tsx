import { Button } from "@mui/material";
import { Link, useNavigate, useRouteError } from "react-router";
import { ChevronLeftIcon, RefreshIcon } from "../../components/icons";
import { reloadApp } from "../../services/pwa";

/** Seating plan with one empty, dashed desk and a question mark badge (matches the app icon). */
function EmptySeatIllustration() {
  const desks = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ];
  return (
    <svg viewBox="0 0 330 200" className="w-64" aria-hidden>
      <rect
        x="55"
        y="0"
        width="220"
        height="16"
        rx="8"
        fill="var(--color-brand-200)"
      />
      {desks.map(([column, row]) => (
        <rect
          key={`${column}-${row}`}
          x={column * 116}
          y={44 + row * 84}
          width="92"
          height="60"
          rx="16"
          fill="white"
          style={{ filter: "drop-shadow(0 4px 8px rgb(43 37 64 / 0.12))" }}
        />
      ))}
      {/* The missing seat */}
      <rect
        x="234"
        y="46"
        width="88"
        height="56"
        rx="15"
        fill="none"
        stroke="var(--color-brand-300)"
        strokeWidth="4"
        strokeDasharray="10 8"
      />
      <circle
        cx="300"
        cy="44"
        r="30"
        fill="var(--color-blush-400)"
        stroke="white"
        strokeWidth="7"
      />
      <text
        x="300"
        y="56"
        textAnchor="middle"
        fontSize="36"
        fontWeight="700"
        fill="white"
        fontFamily="inherit"
      >
        ?
      </text>
    </svg>
  );
}

/**
 * Friendly fallback for unknown URLs (`/404`) and unexpected errors while loading a page.
 * Always offers a way back, so it is never a dead end.
 */
export function ErrorPage() {
  const error = useRouteError();
  // Rendered as `/404` route there is no error, as error boundary there always is one
  const hasError = error != null;
  const navigate = useNavigate();
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  if (hasError) console.error(error);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <main className="card flex max-w-lg flex-col items-center gap-5 px-8 py-10 text-center">
        <EmptySeatIllustration />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold tracking-[0.3em] text-brand-500">
            {hasError ? "FEHLER" : "404"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {hasError ? "Da ist etwas schiefgelaufen" : "Dieser Platz ist leer"}
          </h1>
          <p className="text-muted">
            {hasError
              ? "Die Seite konnte nicht geladen werden. Deine Daten sind weiterhin auf diesem Gerät gespeichert."
              : "Die Seite gibt es nicht (mehr). Vielleicht wurde die Klasse gelöscht oder der Link ist veraltet."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {canGoBack && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<ChevronLeftIcon />}
              onClick={() => navigate(-1)}
            >
              Zurück
            </Button>
          )}
          {hasError && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<RefreshIcon />}
              onClick={reloadApp}
            >
              Neu laden
            </Button>
          )}
          <Button
            component={Link}
            to="/timetable"
            variant="contained"
            size="large"
          >
            Zum Stundenplan
          </Button>
        </div>
      </main>
    </div>
  );
}
