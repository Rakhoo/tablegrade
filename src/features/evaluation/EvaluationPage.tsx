import { Button } from "@mui/material";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { GradeIcon } from "../../components/GradeIcon";
import { GradeToolBar } from "../../components/GradeToolBar";
import { CheckIcon, ChevronLeftIcon } from "../../components/icons";
import {
  setComment,
  setGrade,
  type GradeEntry,
  type SeatedStudent,
} from "../../db";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
} from "../../lib/formatters";
import {
  DEFAULT_GRADE_TOOL,
  getGradeDefinition,
  type GradeTool,
} from "../../lib/grades";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { CommentDialog } from "../classroom/CommentDialog";
import type { EvaluationLoaderData } from "./evaluationLoader";

const entryKey = (studentId: number, date: string) => `${studentId}|${date}`;

/**
 * Evaluation table of a class and school year half: students in rows, lesson dates in columns
 * and the symbols at their intersections. In the grading mode tapping a cell applies the tool.
 */
export function EvaluationPage() {
  const {
    class: cls,
    students,
    entries,
    dates,
  } = useLoaderData<EvaluationLoaderData>();
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [grading, setGrading] = useState(false);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [commenting, setCommenting] = useState<{
    student: SeatedStudent;
    date: string;
  } | null>(null);

  const entryMap = new Map<string, GradeEntry>(
    entries.map((entry) => [entryKey(entry.studentId, entry.date), entry]),
  );
  const lessonDate = searchParams.get("date");
  const isComplete = (date: string) =>
    students.length > 0 &&
    students.every(
      (student) => entryMap.get(entryKey(student.id, date))?.grade,
    );

  const handleTap = async (student: SeatedStudent, date: string) => {
    if (tool == "comment") return setCommenting({ student, date });
    await setGrade(cls.id, student.id, date, tool == "erase" ? null : tool);
    revalidate();
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {grading ? (
        <GradeToolBar
          tool={tool}
          onChange={setTool}
          onExit={() => setGrading(false)}
        />
      ) : (
        <header className="flex flex-wrap items-center gap-3">
          <Button
            component={Link}
            to={
              lessonDate
                ? `/classes/${cls.id}?date=${lessonDate}`
                : "/evaluations"
            }
            startIcon={<ChevronLeftIcon />}
            className="pl-2"
          >
            {lessonDate ? "Zur Stunde" : "Alle Klassen"}
          </Button>
          <div className="mx-auto text-center">
            <div className="text-xl font-bold tracking-tight">
              {formatClassName(cls)} · {cls.subject}
            </div>
            <div className="text-sm text-muted">
              {formatSchoolYear(cls.year)} · {SCHOOL_YEAR_PART_LABELS[cls.part]}
            </div>
          </div>
          <Button
            variant="contained"
            disabled={dates.length == 0}
            startIcon={<GradeIcon grade={DEFAULT_GRADE_TOOL} size={20} />}
            onClick={() => setGrading(true)}
          >
            Bewertung starten
          </Button>
        </header>
      )}

      <main className="card min-h-0 flex-1 overflow-auto">
        {dates.length == 0 || students.length == 0 ? (
          <p className="p-5 text-muted">
            {students.length == 0
              ? "Diese Klasse hat noch keine Schüler."
              : "In diesem Halbjahr gab es noch keinen Unterricht."}
          </p>
        ) : (
          <table className="border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-40 bg-surface" />
                {dates.map((date, index) => (
                  <th
                    key={date}
                    className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
                    // Earlier columns stay on top, so their tilted dates are not covered
                    style={{ zIndex: 10 + dates.length - index }}
                  >
                    <span className="absolute bottom-2 left-1/2 flex origin-bottom-left -rotate-60 items-center gap-1 text-xs font-medium whitespace-nowrap">
                      {format(parseISO(date), "dd.MM.yy")}
                      {isComplete(date) && (
                        <span style={{ color: "#15803d" }}>
                          <CheckIcon size={13} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                {/* Room for the tilted date of the last column */}
                <th className="sticky top-0 min-w-10 border-b border-line bg-surface" />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <th className="sticky left-0 z-10 border-r border-b border-line bg-surface px-3 py-1 text-left font-semibold whitespace-nowrap">
                    {formatStudentName(student)}
                  </th>
                  {dates.map((date) => {
                    const entry = entryMap.get(entryKey(student.id, date));
                    const grade = getGradeDefinition(entry?.grade);
                    return (
                      <td
                        key={date}
                        className="h-11 min-w-11 border-r border-b border-line p-0 text-center"
                      >
                        <button
                          type="button"
                          disabled={!grading}
                          aria-label={`${formatStudentName(student)}, ${date}`}
                          title={entry?.comment ?? undefined}
                          className="relative flex h-full min-h-11 w-full items-center justify-center active:bg-brand-50"
                          onClick={() => handleTap(student, date)}
                        >
                          {grade && <GradeIcon grade={grade.key} size={28} />}
                          {entry?.comment && (
                            <span className="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full bg-brand-500" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {commenting && (
        <CommentDialog
          studentName={formatStudentName(commenting.student)}
          initial={
            entryMap.get(entryKey(commenting.student.id, commenting.date))
              ?.comment ?? ""
          }
          onClose={() => setCommenting(null)}
          onSave={async (comment) => {
            setCommenting(null);
            await setComment(
              cls.id,
              commenting.student.id,
              commenting.date,
              comment,
            );
            revalidate();
          }}
        />
      )}
    </div>
  );
}
