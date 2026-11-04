import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { GradeTarget } from "../../services/grading";

/** Names of the parts of an entry that can be erased on their own. */
const PART_LABELS: Record<GradeTarget, string> = {
  oral: "Mündlich",
  mark: "Nachklausur",
  projectMark: "Projekt",
};

type EraseChoiceDialogProps = {
  studentName: string;
  /** The parts the student has in this lesson, at least two. */
  parts: GradeTarget[];
  /** Called with the part to erase, or `undefined` for all of them. */
  onChoose: (part: GradeTarget | undefined) => void;
  onClose: () => void;
};

/** Asks which grade to erase from a student who has more than one in the lesson. */
export function EraseChoiceDialog({
  studentName,
  parts,
  onChoose,
  onClose,
}: EraseChoiceDialogProps) {
  const choose = (part: GradeTarget | undefined) => {
    onChoose(part);
    onClose();
  };
  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Welche Bewertung löschen?</DialogTitle>
      <DialogContent className="flex flex-col gap-2">
        <div className="text-muted">{studentName}</div>
        {parts.map((part) => (
          <Button key={part} variant="outlined" onClick={() => choose(part)}>
            {PART_LABELS[part]}
          </Button>
        ))}
        <Button
          variant="contained"
          color="error"
          onClick={() => choose(undefined)}
        >
          Alle
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
      </DialogActions>
    </Dialog>
  );
}
