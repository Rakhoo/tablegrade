import { useState } from "react";
import { setAssessment, setReportGrade } from "../db";
import type { Report } from "../lib/reports";
import type { EntryValues } from "../services/grading";

/** A change that can be taken back and made again. */
type Step = { undo: () => Promise<void>; redo: () => Promise<void> };

/**
 * Changes entries and report grades while grading and remembers their order, for undo and redo
 * within one grading session. Call `reset` when a session starts or ends, or when something
 * else changes the entries, as old steps would then restore outdated values.
 */
export function useGradingHistory(
  classId: number | undefined,
  onChanged: () => void,
) {
  const [undoSteps, setUndoSteps] = useState<Step[]>([]);
  const [redoSteps, setRedoSteps] = useState<Step[]>([]);

  const apply = async (step: Step) => {
    await step.redo();
    onChanged();
    setUndoSteps((steps) => [...steps, step]);
    setRedoSteps([]);
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
    await apply({
      undo: () => setAssessment(classId!, studentId, date, before),
      redo: () => setAssessment(classId!, studentId, date, after),
    });
  };

  /** Sets a student's grade in a report as a new step; `null` is the calculated grade. */
  const changeReport = async (
    report: Report,
    studentId: number,
    before: number | null,
    after: number | null,
  ) => {
    if (before == after) return;
    await apply({
      undo: () => setReportGrade(classId!, report, studentId, before),
      redo: () => setReportGrade(classId!, report, studentId, after),
    });
  };

  const undo = async () => {
    const step = undoSteps.at(-1);
    if (!step) return;
    await step.undo();
    onChanged();
    setUndoSteps((steps) => steps.slice(0, -1));
    setRedoSteps((steps) => [...steps, step]);
  };

  const redo = async () => {
    const step = redoSteps.at(-1);
    if (!step) return;
    await step.redo();
    onChanged();
    setRedoSteps((steps) => steps.slice(0, -1));
    setUndoSteps((steps) => [...steps, step]);
  };

  const reset = () => {
    setUndoSteps([]);
    setRedoSteps([]);
  };

  return {
    change,
    changeReport,
    undo,
    redo,
    reset,
    canUndo: undoSteps.length > 0,
    canRedo: redoSteps.length > 0,
  };
}
