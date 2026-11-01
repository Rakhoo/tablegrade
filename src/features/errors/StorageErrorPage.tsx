import { Button } from "@mui/material";

/** Technical facts for finding out why the database could not be opened. */
const getDiagnostics = () => [
  ["Isoliert", String(crossOriginIsolated)],
  ["SharedArrayBuffer", String(typeof SharedArrayBuffer != "undefined")],
  ["Dateisystem", String("getDirectory" in (navigator.storage ?? {}))],
  ["Service Worker", String(!!navigator.serviceWorker?.controller)],
];

/**
 * Shown instead of the app if the database is not stored on the device: everything entered
 * would be lost when closing the app, so nothing can be used.
 */
export function StorageErrorPage() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <main className="card flex max-w-lg flex-col gap-4 p-6">
        <h1 className="text-xl font-bold tracking-tight">
          Der Speicher ist nicht verfügbar
        </h1>
        <p className="text-muted">
          Die Daten dieses Geräts konnten nicht geöffnet werden. Damit nichts
          verloren geht, ist die App gesperrt. Bereits gespeicherte Daten sind
          davon nicht betroffen. Bitte die App vollständig schließen und neu
          öffnen.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 text-sm text-muted">
          {getDiagnostics().map(([label, value]) => (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd className="font-mono">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Neu laden
        </Button>
      </main>
    </div>
  );
}
