import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import type { ReactNode } from "react";
import { GradeIcon } from "../../components/GradeIcon";
import { MarkBadge } from "../../components/MarkBadge";
import type { GradeEntry, SeatedStudent, Trait } from "../../db";
import { isExamDay, MARK_FIELD, MARK_KIND } from "../../lib/grades";
import type { MarkRules, TypesOf } from "../../lib/lessonChains";
import { getColumnKey, type OverviewColumn } from "../../lib/overview";
import { REPORT_LABELS } from "../../lib/reports";

type StudentCardProps = {
  student: SeatedStudent;
  name: string;
  traits: Trait[];
  columns: OverviewColumn[];
  entryOf: (studentId: string, date: string) => GradeEntry | undefined;
  typesOf: TypesOf;
  isCancelled: (date: string) => boolean;
  rules: MarkRules;
  /** Covers all other students in the table; large screens only. */
  onCover?: () => void;
  onClose: () => void;
};

/** One line of the card: what it is about at the left, its symbols at the right. */
function Line({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string | null;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-muted">{detail}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </li>
  );
}

/**
 * All entries of one student, newest first: oral grades, marks of exams, retakes and projects,
 * the comments and the partial and half year grades. Shows a student their own entries without
 * the others', e.g. on a phone.
 */
export function StudentCard({
  student,
  name,
  traits,
  columns,
  entryOf,
  typesOf,
  isCancelled,
  rules,
  onCover,
  onClose,
}: StudentCardProps) {
  const lines = [...columns].reverse().flatMap((column) => {
    const key = getColumnKey(column);
    const day = format(parseISO(column.date), "EEE dd.MM.", { locale: de });
    if (column.kind == "report") {
      const value = column.values.get(student.id) ?? null;
      if (!column.main) return [];
      return [
        <Line key={key} label={REPORT_LABELS[column.report]} detail={day}>
          {value != null ? (
            <MarkBadge mark={value} />
          ) : (
            <span className="text-xs text-muted">n.b.</span>
          )}
        </Line>,
      ];
    }
    const entry = entryOf(student.id, column.date);
    const markKind = column.kind == "projectMark" ? "project" : "exam";
    const type =
      column.kind == "oral"
        ? null
        : typesOf(column.date).find((option) => MARK_KIND[option] == markKind);
    const value =
      column.kind == "oral" ? entry?.grade : entry?.[MARK_FIELD[markKind]];
    // "Absent" belongs to the exam or retake for those writing it, as in the table
    const retaker = rules.isRetaker(student.id, column.date);
    const absent =
      !!entry?.absent &&
      (column.kind == "mark"
        ? isExamDay(typesOf(column.date)) || retaker
        : column.kind == "oral" && !retaker);
    const comment = column.kind == "oral" ? entry?.comment : null;
    if (value == null && !absent && !comment) return [];
    return [
      <Line
        key={key}
        label={
          type
            ? `${day} · ${rules.typeLabel(column.date, type)}`
            : `${day}${isCancelled(column.date) ? " · Ausfall" : ""}`
        }
        detail={comment}
      >
        {value != null &&
          (column.kind == "oral" ? (
            <GradeIcon grade={value} size={26} />
          ) : (
            <MarkBadge mark={value} />
          ))}
        {value == null && absent && <GradeIcon size={26} />}
      </Line>,
    ];
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <div className="flex items-center gap-3 px-6 pt-5 pb-2">
        {student.image && (
          <img
            src={student.image}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{name}</div>
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-x-2 text-xs font-semibold">
              {traits.map((trait) => (
                <span key={trait.id} style={{ color: trait.color }}>
                  {trait.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogContent>
        {lines.length > 0 ? (
          <ul>{lines}</ul>
        ) : (
          <p className="text-sm text-muted">Noch keine Einträge.</p>
        )}
      </DialogContent>
      <DialogActions>
        {onCover && (
          <Button
            onClick={() => {
              onCover();
              onClose();
            }}
          >
            In der Tabelle zeigen
          </Button>
        )}
        <Button variant="contained" onClick={onClose}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
