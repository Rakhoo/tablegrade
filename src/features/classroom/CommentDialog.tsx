import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useState } from "react";

type CommentDialogProps = {
  studentName: string;
  initial: string;
  onSave: (comment: string) => void;
  onClose: () => void;
};

/** Dialog for the comment of a student in the current lesson. Mount it only while open. */
export function CommentDialog({
  studentName,
  initial,
  onSave,
  onClose,
}: CommentDialogProps) {
  const [comment, setComment] = useState(initial);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Kommentar zu {studentName}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={3}
          fullWidth
          margin="dense"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        {initial && (
          <Button color="error" onClick={() => onSave("")} sx={{ mr: "auto" }}>
            Löschen
          </Button>
        )}
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={() => onSave(comment)}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
