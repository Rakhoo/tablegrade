import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useState } from "react";
import type { SeatedStudent } from "../../db";
import { formatStudentName } from "../../lib/formatters";

type NameTrainerDialogProps = {
  /** Students with a photo. */
  students: SeatedStudent[];
  onClose: () => void;
};

const shuffle = <T,>(items: T[]) =>
  items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);

const FACE_STYLE = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
} as const;

/**
 * Flash cards for learning names: the photo on the front, the name on the back. Students
 * marked as not known come back later in the round. Mount it only while open.
 */
export function NameTrainerDialog({
  students,
  onClose,
}: NameTrainerDialogProps) {
  const [queue, setQueue] = useState(() => shuffle(students));
  const [flipped, setFlipped] = useState(false);
  const [card] = queue;

  const answer = (known: boolean) => {
    setFlipped(false);
    setQueue(([first, ...rest]) => {
      if (known) return rest;
      // Not at the very next position, unless it is the last card
      return [...rest.slice(0, 2), first, ...rest.slice(2)];
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle className="flex items-center justify-between">
        Namen lernen
        <span className="text-sm font-medium text-muted">
          {students.length - queue.length} von {students.length}
        </span>
      </DialogTitle>
      <DialogContent>
        {card ? (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              aria-label={flipped ? "Foto zeigen" : "Namen aufdecken"}
              onClick={() => setFlipped(!flipped)}
              className="relative h-72 w-full"
              style={{ perspective: 1000 }}
            >
              <span
                className="absolute inset-0 block transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  transform: flipped ? "rotateY(180deg)" : undefined,
                }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-3xl bg-brand-50"
                  style={FACE_STYLE}
                >
                  <Avatar
                    src={card.image ?? undefined}
                    alt=""
                    sx={{ width: 220, height: 220 }}
                  />
                </span>
                <span
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl bg-brand-600 p-4 text-center text-white"
                  style={{ ...FACE_STYLE, transform: "rotateY(180deg)" }}
                >
                  <span className="text-2xl font-bold">
                    {formatStudentName(card)}
                  </span>
                  {card.nickname && (
                    <span className="text-brand-100">„{card.nickname}“</span>
                  )}
                </span>
              </span>
            </button>
            {flipped ? (
              <div className="flex w-full gap-2">
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={() => answer(false)}
                >
                  Nochmal
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => answer(true)}
                >
                  Gewusst
                </Button>
              </div>
            ) : (
              <Button fullWidth size="large" onClick={() => setFlipped(true)}>
                Namen aufdecken
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="text-xl font-bold">Alle Namen gewusst!</span>
            <Button
              variant="contained"
              onClick={() => setQueue(shuffle(students))}
            >
              Neue Runde
            </Button>
          </div>
        )}
        <div className="mt-3 flex justify-center">
          <Button onClick={onClose}>Beenden</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
