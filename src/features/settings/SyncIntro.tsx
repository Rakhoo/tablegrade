import { Button } from "@mui/material";
import { enableSync } from "../../sync";
import { useSyncAction } from "./useSyncAction";
import { SyncErrorAlert } from "./SyncErrorAlert";

/** Explanation of the account and sync while it is off, with the button that starts the setup. */
export function SyncIntro() {
  const { busy, error, run } = useSyncAction();
  return (
    <>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>
          Mit einem Konto bleiben die Daten auf mehreren Geräten gleich, z. B.
          auf iPad und PC.
        </li>
        <li>
          Die Daten werden schon auf dem Gerät verschlüsselt. Nur die eigenen
          Geräte können sie lesen, der Server nicht.
        </li>
        <li>
          Bei der Einrichtung entsteht ein Wiederherstellungsschlüssel. Ihn gut
          aufbewahren: Ohne ihn sind die Daten weg, wenn alle Geräte verloren
          sind.
        </li>
      </ul>
      <SyncErrorAlert error={error} />
      <div>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => run(enableSync)}
          data-help="Startet die Einrichtung: anmelden, Schlüssel sichern, Daten hochladen."
        >
          Einrichten
        </Button>
      </div>
    </>
  );
}
