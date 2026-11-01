import {
  Alert,
  Button,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { hashPin, PIN_LOCK_ENABLED } from "../../lib/pin";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

const MIN_PIN_LENGTH = 4;

/** Export format, backup reminder and the PIN lock (see `PIN_LOCK_ENABLED`). */
export function DataSettings() {
  const { exportColors, exportValues, backupReminderDays, pinHash } =
    useSettings();
  const save = useSaveSettings();
  const [pin, setPin] = useState("");

  return (
    <SettingsSection title="Export und Sicherung">
      <FormControlLabel
        label="PDF-Export mit Notenfarben"
        control={
          <Switch
            checked={exportColors}
            onChange={(event) => save({ exportColors: event.target.checked })}
          />
        }
      />
      <FormControlLabel
        label="PDF-Export mit Zahlenwerten statt Symbolen"
        control={
          <Switch
            checked={exportValues}
            onChange={(event) => save({ exportValues: event.target.checked })}
          />
        }
      />
      <TextField
        select
        size="small"
        label="An Sicherung erinnern"
        value={backupReminderDays}
        className="max-w-72"
        onChange={(event) =>
          save({ backupReminderDays: Number(event.target.value) })
        }
      >
        <MenuItem value={0}>Nie</MenuItem>
        <MenuItem value={7}>Nach 7 Tagen</MenuItem>
        <MenuItem value={14}>Nach 14 Tagen</MenuItem>
        <MenuItem value={30}>Nach 30 Tagen</MenuItem>
      </TextField>

      {PIN_LOCK_ENABLED && (
        <>
          <Alert severity="info">
            Die PIN sperrt nur die Oberfläche, die Daten bleiben
            unverschlüsselt. Eine vergessene PIN lässt sich nicht zurücksetzen.
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              size="small"
              type="password"
              label={pinHash ? "Neue PIN" : "PIN"}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
            />
            <Button
              variant="outlined"
              disabled={pin.length < MIN_PIN_LENGTH}
              onClick={async () => {
                await save({ pinHash: await hashPin(pin) });
                setPin("");
              }}
            >
              PIN festlegen
            </Button>
            {pinHash && (
              <Button color="error" onClick={() => save({ pinHash: null })}>
                PIN entfernen
              </Button>
            )}
          </div>
        </>
      )}
    </SettingsSection>
  );
}
