import { Button, Step, StepContent, StepLabel, Stepper } from "@mui/material";
import type { ReactNode } from "react";
import type { SyncView } from "../../lib/syncView";
import { disableSync } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncPending } from "./SyncPending";
import { SyncRecoveryKey } from "./SyncRecoveryKey";
import { SyncReplaceCheck } from "./SyncReplaceCheck";
import { SyncSignIn } from "./SyncSignIn";
import { SyncUnlock } from "./SyncUnlock";
import { useSyncAction } from "./useSyncAction";

/** The views the wizard shows, one per step (the key step has two). */
export type SetupView = Extract<
  SyncView,
  "setup" | "pending" | "createKey" | "missingKey" | "replace"
>;

/** Steps that must be done in this order before the device syncs. */
const STEPS: { label: string; views: SetupView[]; caption: string }[] = [
  {
    label: "Anmelden",
    views: ["setup"],
    caption: "Mit Google oder Microsoft",
  },
  {
    label: "Freischaltung",
    views: ["pending"],
    caption: "Neue Konten werden freigeschaltet",
  },
  {
    label: "Schlüssel",
    views: ["createKey", "missingKey"],
    caption: "Ohne ihn lassen sich die Daten nicht lesen",
  },
  {
    label: "Daten abgleichen",
    views: ["replace"],
    caption: "Danach läuft die Synchronisierung",
  },
];

/** Label of the key step: a new account saves its key, another device unlocks. */
const KEY_LABELS: Partial<Record<SetupView, string>> = {
  createKey: "Wiederherstellungsschlüssel sichern",
  missingKey: "Dieses Gerät entsperren",
};

type SyncSetupWizardProps = {
  /** Current step of the setup. */
  view: SetupView;
  /** Called once the new recovery key was saved and checked. */
  onKeyDone: () => void;
};

/**
 * The setup of sync as a list of required steps: done steps are checked, only the current one
 * is open. Sync starts only after the last step, so nothing looks finished before.
 */
export function SyncSetupWizard({ view, onKeyDone }: SyncSetupWizardProps) {
  const active = STEPS.findIndex((step) => step.views.includes(view));
  const content: Record<SetupView, ReactNode> = {
    setup: <SyncSignIn />,
    pending: <SyncPending />,
    createKey: (
      <SyncRecoveryKey
        intro="Das Konto ist angelegt. Jetzt den Wiederherstellungsschlüssel erstellen und sicher aufbewahren."
        onDone={onKeyDone}
      />
    ),
    missingKey: <SyncUnlock />,
    replace: <SyncReplaceCheck />,
  };
  return (
    <>
      <Stepper
        activeStep={active}
        orientation="vertical"
        data-help="Schritte bis zur Synchronisierung; erledigte sind abgehakt, nur der aktuelle ist offen."
      >
        {STEPS.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              optional={
                <span className="text-xs text-muted">{step.caption}</span>
              }
            >
              {(index == active && KEY_LABELS[view]) || step.label}
            </StepLabel>
            <StepContent>
              <div className="flex flex-col gap-3 pt-1">
                {index == active && content[view]}
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      <CancelSetup />
    </>
  );
}

/** Ends an unfinished setup; sync is then off again. */
function CancelSetup() {
  const { busy, error, run } = useSyncAction();
  return (
    <>
      <SyncErrorAlert error={error} />
      <div>
        <Button
          disabled={busy}
          onClick={() => run(disableSync)}
          data-help="Bricht die Einrichtung ab; die Daten bleiben nur auf diesem Gerät."
        >
          Einrichtung abbrechen
        </Button>
      </div>
    </>
  );
}
