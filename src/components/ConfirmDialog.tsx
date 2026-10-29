import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** Color of the confirm button; destructive actions keep the default. */
  confirmColor?: "error" | "primary";
  onConfirm: () => void;
  onClose: () => void;
};

/** Simple yes/no dialog for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Löschen",
  confirmDisabled = false,
  confirmColor = "error",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      {children && <DialogContent>{children}</DialogContent>}
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          color={confirmColor}
          variant="contained"
          disabled={confirmDisabled}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
