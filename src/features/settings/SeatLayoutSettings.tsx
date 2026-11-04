import { Button } from "@mui/material";
import type { SeatedStudent } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import {
  DEFAULT_SEAT_LAYOUT,
  freeSeats,
  seatsOverlap,
} from "../../lib/seating";
import { SeatGrid } from "../classroom/SeatGrid";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** Editor for the seats new students get, in the order of their numbers. */
export function SeatLayoutSettings() {
  const { seatLayout } = useSettings();
  const save = useSaveSettings();
  const layout = seatLayout ?? DEFAULT_SEAT_LAYOUT;

  // The seating plan shows the seats as students named by their number
  const seats: SeatedStudent[] = layout.map(({ x, y }, index) => ({
    id: index + 1,
    firstName: String(index + 1),
    lastName: "",
    nickname: null,
    image: null,
    x,
    y,
    hidden: false,
    traitIds: [],
  }));

  const move = (seat: SeatedStudent, x: number, y: number) => {
    const index = seat.id - 1;
    const overlapped = layout.filter(
      (other, otherIndex) =>
        otherIndex != index && seatsOverlap(other, { x, y }),
    );
    if (overlapped.length > 1) return;
    const [occupant] = overlapped;
    save({
      seatLayout: layout.map((other, otherIndex) => {
        if (otherIndex == index) return occupant ?? { x, y };
        return other == occupant ? layout[index] : other;
      }),
    });
  };

  const addSeat = () => {
    const seat = freeSeats([...layout], layout).next().value;
    if (seat) save({ seatLayout: [...layout, seat] });
  };

  return (
    <SettingsSection
      help="Die Plätze, auf die neue Schüler gesetzt werden."
      title="Standard-Sitzordnung"
      hint="Neue Schüler bekommen diese Plätze in der Reihenfolge der Nummern. Plätze lassen sich ziehen, wie beim Anordnen."
    >
      <div className="h-96 rounded-2xl bg-brand-400 p-2">
        <SeatGrid
          students={seats}
          traits={[]}
          showPhotos={false}
          grades={new Map()}
          suggestions={new Map()}
          arranging
          showComments={false}
          onTap={() => undefined}
          onMove={move}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outlined" onClick={addSeat}>
          Platz hinzufügen
        </Button>
        <Button
          variant="outlined"
          disabled={layout.length <= 1}
          onClick={() => save({ seatLayout: layout.slice(0, -1) })}
        >
          Letzten Platz entfernen
        </Button>
        <Button
          disabled={!seatLayout}
          onClick={() => save({ seatLayout: null })}
        >
          Zurücksetzen
        </Button>
      </div>
    </SettingsSection>
  );
}
