import { Button, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { confirmDeviceLink, type DeviceLinkApproval } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/**
 * Linking on a device that already syncs: takes the code that the new device shows, shows the
 * check code to compare and sends the key once the user confirmed that both codes match.
 */
export function SyncApproveLink() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [approval, setApproval] = useState<DeviceLinkApproval | null>(null);
  const { busy, error, run } = useSyncAction();

  /** Closes the link and forgets the code. */
  const close = () => {
    setOpen(false);
    setCode("");
    setApproval(null);
  };

  /** Looks up the typed code. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = await run(() => confirmDeviceLink(code.trim()));
    if (found) setApproval(found);
  };

  /** Sends the key to the new device. */
  const approve = async (current: DeviceLinkApproval) => {
    const done = await run(async () => {
      await current.approve();
      return true;
    });
    if (done) close();
  };

  if (!open)
    return (
      <div>
        <Button
          variant="outlined"
          onClick={() => setOpen(true)}
          data-help="Gibt einem neuen Gerät den Schlüssel zu den Daten. Das neue Gerät zeigt dafür einen Code."
        >
          Gerät koppeln
        </Button>
      </div>
    );
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      {approval ? (
        <p
          className="text-sm"
          data-help="Gleiche Prüfcodes zeigen, dass niemand dazwischen ist."
        >
          Prüfcode:{" "}
          <span className="font-mono text-lg">{approval.checkCode}</span>. Zeigt
          das neue Gerät denselben Prüfcode?
        </p>
      ) : (
        <TextField
          size="small"
          label="Code vom neuen Gerät"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          className="max-w-60"
          slotProps={{
            htmlInput: {
              autoCapitalize: "characters",
              spellCheck: false,
              className: "font-mono",
            },
          }}
          data-help="Der Code, den das neue Gerät unter „Mit anderem Gerät koppeln“ zeigt."
        />
      )}
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        {approval ? (
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => approve(approval)}
            data-help="Sendet den Schlüssel verschlüsselt an das neue Gerät."
          >
            Stimmt überein
          </Button>
        ) : (
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !code.trim()}
            data-help="Sucht das neue Gerät zu diesem Code."
          >
            Weiter
          </Button>
        )}
        <Button onClick={close} data-help="Bricht die Kopplung ab.">
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
