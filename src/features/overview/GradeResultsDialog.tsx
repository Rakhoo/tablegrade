import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import type { GradeEntry, SeatedStudent } from "../../db";
import { formatGrade, getStudentResult } from "../../lib/assessment";
import { useSettings } from "../../hooks/useSettings";
import { toIsoDate } from "../../lib/dates";
import type { LessonType } from "../../lib/grades";

type GradeResultsDialogProps = {
  /** Students in display order. */
  students: SeatedStudent[];
  entries: GradeEntry[];
  /** Lesson dates that can be selected, oldest first. */
  dates: string[];
  nameOf: (student: SeatedStudent) => string;
  typeOf: (date: string) => LessonType;
  onClose: () => void;
};

/**
 * Calculated grades of all students as of today or a lesson date.
 * Mount it only while open.
 */
export function GradeResultsDialog({
  students,
  entries,
  dates,
  nameOf,
  typeOf,
  onClose,
}: GradeResultsDialogProps) {
  const settings = useSettings();
  const today = toIsoDate(new Date());
  const [date, setDate] = useState(today);
  const lessonDates = dates.filter((lessonDate) => lessonDate != today);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Noten</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Stand"
          size="small"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 min-w-56"
        >
          <MenuItem value={today}>Heute</MenuItem>
          {[...lessonDates].reverse().map((lessonDate) => (
            <MenuItem key={lessonDate} value={lessonDate}>
              {format(parseISO(lessonDate), "EEEEEE, dd.MM.yyyy", {
                locale: de,
              })}
            </MenuItem>
          ))}
        </TextField>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-line text-right text-xs text-muted">
              <th className="py-1 text-left font-semibold">Schüler</th>
              <th className="px-2 py-1 font-semibold">Mündlich</th>
              <th className="px-2 py-1 font-semibold">Projekte</th>
              <th className="px-2 py-1 font-semibold">Klausuren</th>
              <th className="py-1 pl-2 font-semibold">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const result = getStudentResult(
                entries.filter((entry) => entry.studentId == student.id),
                typeOf,
                date,
                settings,
              );
              return (
                <tr
                  key={student.id}
                  className="border-b border-line text-right last:border-0"
                >
                  <td className="py-1.5 text-left font-medium">
                    {nameOf(student)}
                  </td>
                  <td className="px-2 text-muted">
                    {formatGrade(result.oral)}
                  </td>
                  <td className="px-2 text-muted">
                    {formatGrade(result.project)}
                  </td>
                  <td className="px-2 text-muted">
                    {formatGrade(result.exam)}
                  </td>
                  <td className="pl-2 font-bold">
                    {formatGrade(result.total, "n.b.")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
