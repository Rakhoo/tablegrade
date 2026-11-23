import { Alert } from "@mui/material";

type SyncErrorAlertProps = {
  /** German message of the last failed step; nothing is shown without one. */
  error: string | null;
};

/** Message of a failed account or sync step. */
export function SyncErrorAlert({ error }: SyncErrorAlertProps) {
  return error && <Alert severity="error">{error}</Alert>;
}
