import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { resetEditHistory } from "../../hooks/useEditHistory";
import { saveBackup } from "../../services/backup";
import { SettingsSection } from "./SettingsSection";

/** Word to type before all data is replaced. */
const CONFIRM_WORD = "LÖSCHEN";

/**
 * Hidden developer options (unlocked by tapping the tab "Daten und Export" seven times): fill
 * the app with mock data, after a strong warning.
 */
export function DevSettings() {
  const { revalidate } = useRevalidator();
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const confirmed = acknowledged && typed.trim() == CONFIRM_WORD;

  const close = () => {
    if (running) return;
    setOpen(false);
    setAcknowledged(false);
    setTyped("");
  };

  const fill = async () => {
    setRunning(true);
    try {
      const { fillWithMockData } = await import("../../services/mockData");
      await fillWithMockData();
      resetEditHistory();
      await revalidate();
      setMessage({
        error: false,
        text: "Die App wurde mit Beispieldaten gefüllt.",
      });
    } catch (error) {
      setMessage({
        error: true,
        text: `Das Füllen ist fehlgeschlagen (${(error as Error).message}). Die Daten können unvollständig sein.`,
      });
    } finally {
      setRunning(false);
      setOpen(false);
      setAcknowledged(false);
      setTyped("");
    }
  };

  return (
    <SettingsSection
      title="Entwickler"
      hint="Nur zum Ausprobieren und für Vorführungen."
      help="Versteckte Entwickleroptionen."
    >
      <Button
        color="error"
        variant="outlined"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        Mit Beispieldaten füllen …
      </Button>
      {message && (
        <Alert
          severity={message.error ? "error" : "success"}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>Alle Daten durch Beispieldaten ersetzen?</DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-3">
            <Alert severity="error">
              <strong>
                Alle Klassen, Schüler, Fotos, Noten, Kommentare, Ermahnungen,
                Teilnoten, Ausfälle, Eigenschaften und Dienste werden
                unwiderruflich gelöscht.
              </strong>{" "}
              Danach enthält die App nur noch erfundene Klassen und Schüler.
              Einstellungen, Ferien und Schuljahre bleiben erhalten.
            </Alert>
            <p>
              Die echten Daten lassen sich nur mit einer vorher erstellten
              Sicherung zurückholen.
            </p>
            <Button
              variant="outlined"
              className="self-start"
              disabled={running}
              onClick={() => saveBackup()}
            >
              Vorher Sicherung erstellen
            </Button>
            <FormControlLabel
              className="rounded-2xl bg-red-50 py-1 pr-3 text-gray-900"
              control={
                <Checkbox
                  color="error"
                  checked={acknowledged}
                  disabled={running}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
              }
              label="Ich habe verstanden, dass alle echten Daten gelöscht werden."
            />
            <TextField
              size="small"
              label={`Zum Bestätigen „${CONFIRM_WORD}“ eingeben`}
              value={typed}
              disabled={running}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value.toUpperCase())}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={running}>
            Abbrechen
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!confirmed || running}
            onClick={fill}
          >
            {running ? "Wird erstellt …" : "Alles löschen und füllen"}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsSection>
  );
}
