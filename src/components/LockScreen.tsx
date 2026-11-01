import { Button, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { hashPin } from "../lib/pin";

type LockScreenProps = {
  pinHash: string;
  onUnlock: () => void;
};

/** Asks for the PIN before showing the app. It only protects the interface, not the data. */
export function LockScreen({ pinHash, onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await hashPin(pin)) == pinHash) onUnlock();
    else {
      setWrong(true);
      setPin("");
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-4">
      <form onSubmit={submit} className="card flex w-80 flex-col gap-4 p-6">
        <h1 className="text-center text-xl font-bold">Gesperrt</h1>
        <TextField
          autoFocus
          type="password"
          label="PIN"
          value={pin}
          error={wrong}
          helperText={wrong ? "Falsche PIN" : " "}
          onChange={(event) => setPin(event.target.value)}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        <Button type="submit" variant="contained" disabled={!pin}>
          Entsperren
        </Button>
      </form>
    </div>
  );
}
