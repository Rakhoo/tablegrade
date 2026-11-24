import { Button } from "@mui/material";
import { useState } from "react";
import { SyncRecoveryKey } from "./SyncRecoveryKey";

/** Replaces the recovery key, e.g. when the old one is lost; shows the new one once. */
export function SyncNewRecoveryKey() {
  const [creating, setCreating] = useState(false);
  if (creating)
    return (
      <SyncRecoveryKey
        intro="Der bisherige Wiederherstellungsschlüssel wird dabei ungültig."
        onDone={() => setCreating(false)}
        onCancel={() => setCreating(false)}
      />
    );
  return (
    <div>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setCreating(true)}
        data-help="Ersetzt den Wiederherstellungsschlüssel, z. B. wenn der alte verloren ist. Der alte wird ungültig."
      >
        Neuer Wiederherstellungsschlüssel
      </Button>
    </div>
  );
}
