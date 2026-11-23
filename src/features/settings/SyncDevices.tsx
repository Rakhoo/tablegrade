import { Button } from "@mui/material";
import { format } from "date-fns";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { listDevices, revokeDevice, type Device } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** Date and time as shown in the list. */
const formatTime = (time: number) => format(time, "dd.MM.yyyy 'um' HH:mm");

/** State of a device for its line in the list. */
function describeDevice({ current, lastSeenAt, revokedAt }: Device) {
  if (revokedAt != null) return `gesperrt am ${formatTime(revokedAt)}`;
  if (current) return "dieses Gerät";
  return `zuletzt aktiv am ${formatTime(lastSeenAt)}`;
}

/**
 * Devices of the account, loaded on request so opening the settings sends no request. Other
 * devices can be revoked; they keep their data but can no longer sync.
 */
export function SyncDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [revoking, setRevoking] = useState<Device | null>(null);
  const { busy, error, run } = useSyncAction();

  /** Loads the list of devices. */
  const load = async () => {
    const loaded = await run(listDevices);
    if (loaded) setDevices(loaded);
  };

  /** Revokes the device and loads the list again. */
  const revoke = async ({ id }: Device) => {
    const loaded = await run(async () => {
      await revokeDevice(id);
      return listDevices();
    });
    if (loaded) setDevices(loaded);
  };

  return (
    <>
      <SyncErrorAlert error={error} />
      {devices && (
        <ul className="flex flex-col gap-1 text-sm">
          {devices.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center gap-x-2"
              data-help="Gerät des Kontos mit seiner letzten Verbindung zum Server."
              data-help-repeat
            >
              <span className={device.revokedAt != null ? "line-through" : ""}>
                {device.name}
              </span>
              <span className="opacity-70">{describeDevice(device)}</span>
              {!device.current && device.revokedAt == null && (
                <Button
                  size="small"
                  color="error"
                  disabled={busy}
                  onClick={() => setRevoking(device)}
                >
                  Sperren
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={load}
          data-help="Zeigt alle Geräte des Kontos. Ein verlorenes Gerät lässt sich dort sperren."
        >
          {devices ? "Geräte neu laden" : "Geräte anzeigen"}
        </Button>
      </div>
      <ConfirmDialog
        open={revoking != null}
        title={`„${revoking?.name}“ sperren?`}
        confirmLabel="Sperren"
        onConfirm={() => revoking && void revoke(revoking)}
        onClose={() => setRevoking(null)}
      >
        Das Gerät kann danach nicht mehr synchronisieren. Seine Daten bleiben
        auf dem Gerät. Zum erneuten Nutzen muss es neu angemeldet und gekoppelt
        werden.
      </ConfirmDialog>
    </>
  );
}
