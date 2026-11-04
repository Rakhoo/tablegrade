import { useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import {
  moveStudentSeat,
  setAssessment,
  setReportGrade,
  setStudentSeats,
  setWarnings,
  type SeatPosition,
} from "../db";
import type { Report } from "../lib/reports";
import type { EntryValues } from "../services/grading";

/** What a step changed, named after the mode it was made in. */
export type EditAction =
  "Ermahnung" | "Maßnahme" | "Bewertung" | "Kommentar" | "Anordnung";

/** The page a step was made on, to return to it before taking it back or making it again. */
export type EditPage = {
  /** Identifies the page, e.g. the seating plan of one lesson. */
  key: string;
  url: string;
  /** Name of the page, e.g. "Übersicht". */
  label: string;
};

/** What a step changed: its mode, e.g. the student and the new value, and its page. */
export type EditStep = {
  action: EditAction;
  description: string;
  /** The step removed something, e.g. a grade or a warning. */
  removed?: boolean;
  page: EditPage;
};

/** A change that can be taken back and made again. */
type Step = EditStep & {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

// One history for the seating plans and overview tables, so steps stay across their pages
let state = { undo: [] as Step[], redo: [] as Step[] };
const listeners = new Set<() => void>();
const setState = (next: typeof state) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Changes, undos and redos run one after the other, each on the history as the previous one
// left it; taps in quick succession wait instead of acting on an outdated step
let queue = Promise.resolve();
const enqueue = (job: () => Promise<unknown>) => {
  queue = queue
    .then(async () => {
      await job();
    })
    .catch((error) => console.error(error));
  return queue;
};

/**
 * Clears the history, e.g. when something else changed the data, as old steps would then
 * restore outdated values.
 */
export const resetEditHistory = () => setState({ undo: [], redo: [] });

/**
 * Changes warnings, grades, comments and seats and remembers their order, for one undo and
 * redo shared by the modes and pages of the classes. A step made on another page first leads
 * there; that page change is no step of its own.
 * @param page The page the hook is used on.
 * @param onChanged Reloads the page's data after a change.
 */
export function useEditHistory(
  classId: number | undefined,
  page: EditPage,
  onChanged: () => void,
) {
  const navigate = useNavigate();
  const { undo: undoSteps, redo: redoSteps } = useSyncExternalStore(
    subscribe,
    () => state,
  );

  const apply = async (
    step: Omit<Step, "page" | "action"> & { action: EditAction },
  ) =>
    enqueue(async () => {
      await step.redo();
      onChanged();
      setState({ undo: [...state.undo, { ...step, page }], redo: [] });
    });

  /** Applies `values` to a student's entry as a new step, dropping undone steps. */
  const change = async (
    action: "Bewertung" | "Kommentar",
    studentId: number,
    date: string,
    entry: Partial<EntryValues> | undefined,
    values: Partial<EntryValues>,
    description: string,
  ) => {
    const before: EntryValues = {
      grade: entry?.grade ?? null,
      mark: entry?.mark ?? null,
      projectMark: entry?.projectMark ?? null,
      absent: entry?.absent ?? false,
      comment: entry?.comment ?? null,
    };
    const after = { ...before, ...values };
    if (JSON.stringify(before) == JSON.stringify(after)) return;
    const changed = Object.keys(values) as (keyof EntryValues)[];
    await apply({
      action,
      description,
      removed: changed.every((key) => !after[key]),
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
    description: string,
  ) => {
    if (before == after) return;
    await apply({
      action: "Bewertung",
      description,
      // Erasing a grade set by hand brings the calculated one back
      removed: after == null,
      undo: () => setReportGrade(classId!, report, studentId, before),
      redo: () => setReportGrade(classId!, report, studentId, after),
    });
  };

  /** Sets the warning level of a student in a lesson as a new step. */
  const changeWarnings = async (
    studentId: number,
    date: string,
    before: number,
    after: number,
    description: string,
  ) => {
    await apply({
      // A step to or from the second level concerns the measure, not the warning
      action: Math.max(before, after) >= 2 ? "Maßnahme" : "Ermahnung",
      description,
      removed: after == 0,
      undo: () => setWarnings(classId!, studentId, date, before),
      redo: () => setWarnings(classId!, studentId, date, after),
    });
  };

  /**
   * Moves a student as a new step. Undoing puts all students back on `seats`, as a move can
   * swap two of them.
   */
  const moveSeat = async (
    studentId: number,
    x: number,
    y: number,
    seats: SeatPosition[],
    description: string,
  ) => {
    await apply({
      action: "Anordnung",
      description,
      undo: () => setStudentSeats(classId!, seats),
      redo: () => moveStudentSeat(classId!, studentId, x, y),
    });
  };

  /** Whether a step was made on another page, so undo or redo first leads there. */
  const isElsewhere = (step: Step | undefined) =>
    !!step && step.page.key != page.key;

  const undo = () =>
    enqueue(async () => {
      const step = state.undo.at(-1);
      if (!step) return;
      if (isElsewhere(step)) return navigate(step.page.url);
      await step.undo();
      onChanged();
      setState({ undo: state.undo.slice(0, -1), redo: [...state.redo, step] });
    });

  const redo = () =>
    enqueue(async () => {
      const step = state.redo.at(-1);
      if (!step) return;
      if (isElsewhere(step)) return navigate(step.page.url);
      await step.redo();
      onChanged();
      setState({ undo: [...state.undo, step], redo: state.redo.slice(0, -1) });
    });

  return {
    change,
    changeReport,
    changeWarnings,
    moveSeat,
    undo,
    redo,
    reset: resetEditHistory,
    /** The step the next undo takes back, `null` if there is none. */
    undoStep: (undoSteps.at(-1) ?? null) as EditStep | null,
    /** The step the next redo makes again, `null` if there is none. */
    redoStep: (redoSteps.at(-1) ?? null) as EditStep | null,
    /** Whether the next undo first leads to another page. */
    undoElsewhere: isElsewhere(undoSteps.at(-1)),
    /** Whether the next redo first leads to another page. */
    redoElsewhere: isElsewhere(redoSteps.at(-1)),
  };
}

export type EditHistory = ReturnType<typeof useEditHistory>;
