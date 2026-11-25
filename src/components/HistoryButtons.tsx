import { IconButton, Snackbar } from "@mui/material";
import { useState, type ReactNode } from "react";
import type { EditHistory, EditStep } from "../hooks/useEditHistory";
import { RedoIcon, UndoIcon } from "./icons";

type HistoryButtonProps = {
  icon: ReactNode;
  label: string;
  step: EditStep | null;
  /** The step was made on another page, which the button opens first. */
  elsewhere: boolean;
  onClick: () => void;
  /** As wide as the container instead of a fixed width. */
  stacked: boolean;
};

/** Undo or redo as one pill of fixed width with its step, disabled without one. */
function HistoryButton({
  icon,
  label,
  step,
  elsewhere,
  onClick,
  stacked,
}: HistoryButtonProps) {
  return (
    <button
      type="button"
      disabled={!step}
      onClick={onClick}
      aria-label={
        step ? `${label}: ${step.action}, ${step.description}` : label
      }
      className={
        "flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-brand-50 pr-3 pl-2 text-xs text-brand-700 transition-transform active:scale-95 disabled:opacity-40 " +
        (stacked ? "w-full" : "w-52 portrait:w-36")
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-center">
        {step ? (
          <>
            {elsewhere ? (
              <span className="font-semibold">Zu: {step.page.label}</span>
            ) : (
              // Removals are struck through, e.g. a deleted grade
              <span
                className={
                  "font-semibold " + (step.removed ? "line-through" : "")
                }
              >
                {step.action}
              </span>
            )}{" "}
            <span className="text-muted">
              {elsewhere ? step.action : step.description}
            </span>
          </>
        ) : (
          <span className="font-semibold">{label}</span>
        )}
      </span>
    </button>
  );
}

/** Text of a step for screen readers and the notice of the round buttons. */
const describeStep = (step: EditStep, elsewhere: boolean) =>
  elsewhere
    ? `Zu: ${step.page.label}, ${step.action}`
    : `${step.action}${step.removed ? " (entfernt)" : ""}: ${step.description}`;

type HistoryButtonsProps = {
  history: EditHistory;
  /**
   * Two round buttons without the steps, for small screens and the side bar; the step undone
   * or redone shows in a short notice.
   */
  round?: boolean;
  /** Pills stacked instead of side by side, as wide as their container. */
  stacked?: boolean;
};

/** Undo and redo of the shared history, each with the step it applies to. */
export function HistoryButtons({
  history,
  round = false,
  stacked = false,
}: HistoryButtonsProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const help =
    "Rückgängig und Wiederholen, auch für Änderungen auf anderen Seiten (der erste Tipp öffnet sie).";
  if (round) {
    /** Runs undo or redo and names its step in the notice. */
    const run = (
      label: string,
      step: EditStep | null,
      elsewhere: boolean,
      action: () => void,
    ) => {
      if (step) setNotice(`${label}: ${describeStep(step, elsewhere)}`);
      action();
    };
    const buttonClass =
      "bg-surface text-brand-700 shadow-tile disabled:opacity-40";
    return (
      <div className="flex shrink-0 items-center gap-1.5" data-help={help}>
        <IconButton
          aria-label={
            history.undoStep
              ? `Rückgängig: ${describeStep(history.undoStep, history.undoElsewhere)}`
              : "Rückgängig"
          }
          disabled={!history.undoStep}
          className={buttonClass}
          onClick={() =>
            run(
              "Rückgängig",
              history.undoStep,
              history.undoElsewhere,
              history.undo,
            )
          }
        >
          <UndoIcon size={20} />
        </IconButton>
        <IconButton
          aria-label={
            history.redoStep
              ? `Wiederholen: ${describeStep(history.redoStep, history.redoElsewhere)}`
              : "Wiederholen"
          }
          disabled={!history.redoStep}
          className={buttonClass}
          onClick={() =>
            run(
              "Wiederholt",
              history.redoStep,
              history.redoElsewhere,
              history.redo,
            )
          }
        >
          <RedoIcon size={20} />
        </IconButton>
        <Snackbar
          open={!!notice}
          message={notice}
          autoHideDuration={2500}
          onClose={() => setNotice(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        />
      </div>
    );
  }
  return (
    <div
      className={
        "flex min-w-0 gap-1 " +
        (stacked ? "flex-col items-stretch" : "items-center")
      }
      data-help={help}
    >
      <HistoryButton
        icon={<UndoIcon size={16} />}
        label="Rückgängig"
        step={history.undoStep}
        elsewhere={history.undoElsewhere}
        onClick={history.undo}
        stacked={stacked}
      />
      <HistoryButton
        icon={<RedoIcon size={16} />}
        label="Wiederholen"
        step={history.redoStep}
        elsewhere={history.redoElsewhere}
        onClick={history.redo}
        stacked={stacked}
      />
    </div>
  );
}
