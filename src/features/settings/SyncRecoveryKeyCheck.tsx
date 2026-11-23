import { Button, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { isGroupCorrect, pickCheckGroups } from "../../lib/recoveryKeyCheck";

type SyncRecoveryKeyCheckProps = {
  /** The formatted recovery key that was shown. */
  recoveryKey: string;
  /** Shows the key again. */
  onBack: () => void;
  /** Called once both groups are correct. */
  onDone: () => void;
};

/**
 * Asks for two random groups of the recovery key, typed from where it was saved, so a key
 * that was not kept is noticed now and not when it is needed.
 */
export function SyncRecoveryKeyCheck({
  recoveryKey,
  onBack,
  onDone,
}: SyncRecoveryKeyCheckProps) {
  const [positions] = useState(() => pickCheckGroups(recoveryKey));
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const wrong = positions.filter(
    (position) => !isGroupCorrect(recoveryKey, position, typed[position] ?? ""),
  );

  /** Finishes when all groups match, otherwise marks the wrong ones. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (wrong.length == 0) onDone();
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <p className="text-sm">
        Zur Kontrolle: Die folgenden Gruppen aus dem gesicherten Schlüssel
        eingeben (nicht vom Bildschirm abschreiben).
      </p>
      <div
        className="flex flex-wrap gap-2"
        data-help="Zwei zufällige Vierergruppen des Schlüssels. So fällt jetzt auf, wenn er nicht richtig gesichert ist."
      >
        {positions.map((position) => {
          const isWrong = submitted && wrong.includes(position);
          return (
            <TextField
              key={position}
              size="small"
              label={`Gruppe ${position + 1}`}
              value={typed[position] ?? ""}
              onChange={(event) =>
                setTyped({ ...typed, [position]: event.target.value })
              }
              error={isWrong}
              helperText={isWrong ? "Stimmt nicht" : " "}
              autoComplete="off"
              className="w-32"
              slotProps={{
                htmlInput: {
                  maxLength: 6,
                  autoCapitalize: "characters",
                  spellCheck: false,
                  className: "font-mono",
                },
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} data-help="Zeigt den Schlüssel noch einmal.">
          Schlüssel zeigen
        </Button>
        <Button
          type="submit"
          variant="contained"
          data-help="Prüft die Gruppen und schließt die Sicherung des Schlüssels ab."
        >
          Bestätigen
        </Button>
      </div>
    </form>
  );
}
