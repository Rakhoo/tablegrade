import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { addReport, removeReport, type GradeEntry } from "../../db";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import type { MarkRules, TypesOf } from "../../lib/lessonChains";
import {
  getReportChangeError,
  REPORT_LABELS,
  type Report,
  type ReportKind,
} from "../../lib/reports";
import type { OverviewLoaderData } from "./overviewLoader";
import { LessonTypeMenu } from "./LessonTypeMenu";

type DateMenuOptions = {
  classId: number;
  entries: GradeEntry[];
  reports: Report[];
  reportGrades: OverviewLoaderData["reportGrades"];
  typesOf: TypesOf;
  isCancelled: (date: string) => boolean;
  rules: MarkRules;
  /** Called after a type or report changed. */
  onChanged: () => void;
  onMessage: (message: string) => void;
};

/**
 * The menu of a date in the overview: changes the lesson's types and adds or removes reports,
 * asking first where that deletes grades.
 * @returns The function opening the menu and the menu with its dialogs to render.
 */
export function useDateMenu({
  classId,
  entries,
  reports,
  reportGrades,
  typesOf,
  isCancelled,
  rules,
  onChanged,
  onMessage,
}: DateMenuOptions) {
  const [menu, setMenu] = useState<{
    date: string;
    anchor: HTMLElement;
  } | null>(null);
  const [removal, setRemoval] = useState<{
    report: Report;
    grades: number;
  } | null>(null);
  const { requestLessonType, lessonTypeDialog } = useLessonTypeChange(
    classId,
    onChanged,
  );

  const hasReport = (date: string, kind: ReportKind) =>
    reports.some((report) => report.date == date && report.kind == kind);

  /** Adds or removes a report; removing asks first if that deletes grades set by hand. */
  const toggleReport = async (date: string, kind: ReportKind) => {
    setMenu(null);
    const report = { date, kind };
    const error = getReportChangeError(reports, report);
    if (error) return onMessage(error);
    if (!hasReport(date, kind)) {
      await addReport(classId, report);
      return onChanged();
    }
    const grades = reportGrades.filter(
      (grade) => grade.date == date && grade.kind == kind,
    ).length;
    if (grades > 0) return setRemoval({ report, grades });
    await removeReport(classId, report);
    onChanged();
  };

  const date = menu?.date;
  const element = (
    <>
      <LessonTypeMenu
        anchor={menu?.anchor ?? null}
        available={date && !isCancelled(date) ? rules.availableTypes(date) : []}
        types={date ? typesOf(date) : []}
        hasReport={(kind) => !!date && hasReport(date, kind)}
        onType={(type) => {
          setMenu(null);
          if (!date) return;
          requestLessonType(
            date,
            typesOf(date),
            type,
            entries.filter((entry) => entry.date == date),
          );
        }}
        onReport={(kind) => date && toggleReport(date, kind)}
        onClose={() => setMenu(null)}
      />

      {lessonTypeDialog}

      {removal && (
        <ConfirmDialog
          open
          title={`${REPORT_LABELS[removal.report.kind]} entfernen?`}
          confirmLabel="Entfernen"
          onClose={() => setRemoval(null)}
          onConfirm={async () => {
            await removeReport(classId, removal.report);
            setRemoval(null);
            onChanged();
          }}
        >
          {`Die ${removal.grades} manuell gesetzten Noten werden gelöscht.`}
        </ConfirmDialog>
      )}
    </>
  );

  return {
    openMenu: (menuDate: string, anchor: HTMLElement) =>
      setMenu({ date: menuDate, anchor }),
    menu: element,
  };
}
