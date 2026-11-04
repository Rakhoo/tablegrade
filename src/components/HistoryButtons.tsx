import type { ReactNode } from "react";
import type { EditHistory, EditStep } from "../hooks/useEditHistory";
import { RedoIcon, UndoIcon } from "./icons";

type HistoryButtonProps = {
  icon: ReactNode;
  label: string;
  step: EditStep | null;
  /** The step was made on another page, which the button opens first. */
  elsewhere: boolean;
  onClick: () => void;
};

/** Undo or redo as one pill of fixed width with its step, disabled without one. */
function HistoryButton({
  icon,
  label,
  step,
  elsewhere,
  onClick,
}: HistoryButtonProps) {
  return (
    <button
      type="button"
      disabled={!step}
      onClick={onClick}
      aria-label={
        step ? `${label}: ${step.action}, ${step.description}` : label
      }
      className="flex h-7 w-52 min-w-0 items-center gap-1.5 rounded-full bg-brand-50 pr-3 pl-2 text-xs text-brand-700 transition-transform active:scale-95 disabled:opacity-40 portrait:w-36"
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

/** Undo and redo of the shared history, each with the step it applies to. */
export function HistoryButtons({ history }: { history: EditHistory }) {
  return (
    <div
      className="flex min-w-0 items-center gap-1"
      data-help="Rückgängig und Wiederholen für alle Änderungen in Sitzplänen und Übersichten. War die Änderung auf einer anderen Seite, öffnet der erste Tipp diese Seite."
    >
      <HistoryButton
        icon={<UndoIcon size={16} />}
        label="Rückgängig"
        step={history.undoStep}
        elsewhere={history.undoElsewhere}
        onClick={history.undo}
      />
      <HistoryButton
        icon={<RedoIcon size={16} />}
        label="Wiederholen"
        step={history.redoStep}
        elsewhere={history.redoElsewhere}
        onClick={history.redo}
      />
    </div>
  );
}
