import { useState } from "react";
import { setAssessment } from "../db";
import type { EntryValues } from "../services/grading";

type EntryChange = {
  studentId: number;
  date: string;
  before: EntryValues;
  after: EntryValues;
};

/**
 * Changes entries while grading and remembers their order, for undo and redo within one
 * grading session. Call `reset` when a session starts or ends, or when something else
 * changes the entries, as old steps would then restore outdated values.
 */
export function useGradingHistory(
  classId: number | undefined,
  onChanged: () => void,
) {
  const [undoSteps, setUndoSteps] = useState<EntryChange[]>([]);
  const [redoSteps, setRedoSteps] = useState<EntryChange[]>([]);

  const write = async (
    { studentId, date }: EntryChange,
    values: EntryValues,
  ) => {
    await setAssessment(classId!, studentId, date, values);
    onChanged();
  };

  /** Applies `values` to a student's entry as a new step, dropping undone steps. */
  const change = async (
    studentId: number,
    date: string,
    entry: Partial<EntryValues> | undefined,
    values: Partial<EntryValues>,
  ) => {
    const before: EntryValues = {
      grade: entry?.grade ?? null,
      mark: entry?.mark ?? null,
      absent: entry?.absent ?? false,
      comment: entry?.comment ?? null,
    };
    const after = { ...before, ...values };
    if (JSON.stringify(before) == JSON.stringify(after)) return;
    const step = { studentId, date, before, after };
    await write(step, after);
    setUndoSteps((steps) => [...steps, step]);
    setRedoSteps([]);
  };

  const undo = async () => {
    const step = undoSteps.at(-1);
    if (!step) return;
    await write(step, step.before);
    setUndoSteps((steps) => steps.slice(0, -1));
    setRedoSteps((steps) => [...steps, step]);
  };

  const redo = async () => {
    const step = redoSteps.at(-1);
    if (!step) return;
    await write(step, step.after);
    setRedoSteps((steps) => steps.slice(0, -1));
    setUndoSteps((steps) => [...steps, step]);
  };

  const reset = () => {
    setUndoSteps([]);
    setRedoSteps([]);
  };

  return {
    change,
    undo,
    redo,
    reset,
    canUndo: undoSteps.length > 0,
    canRedo: redoSteps.length > 0,
  };
}
