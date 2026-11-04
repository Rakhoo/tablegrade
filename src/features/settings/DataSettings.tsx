import {
  Alert,
  Button,
  FormControlLabel,
  Switch,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { hashPin, PIN_LOCK_ENABLED } from "../../lib/pin";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

const MIN_PIN_LENGTH = 4;

/** Export format and the PIN lock (see `PIN_LOCK_ENABLED`). */
export function DataSettings() {
  const {
    exportColors,
    exportValues,
    exportNoPhotos,
    exportNoTraits,
    pinHash,
  } = useSettings();
  const save = useSaveSettings();
  const [pin, setPin] = useState("");

  return (
    <SettingsSection
      title="Export"
      help="Wie die Übersichtstabellen als PDF exportiert werden."
    >
      <FormControlLabel
        label="PDF-Export in Farbe"
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
      <FormControlLabel
        label="Bilder nie exportieren"
        control={
          <Switch
            checked={exportNoPhotos}
            onChange={(event) => save({ exportNoPhotos: event.target.checked })}
          />
        }
      />
      <FormControlLabel
        label="Eigenschaften nie exportieren"
        control={
          <Switch
            checked={exportNoTraits}
            onChange={(event) => save({ exportNoTraits: event.target.checked })}
          />
        }
      />

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
