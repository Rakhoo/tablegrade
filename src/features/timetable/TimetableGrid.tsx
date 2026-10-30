import { addDays, format, isToday } from "date-fns";
import { de } from "date-fns/locale/de";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { CheckIcon } from "../../components/icons";
import type { Holiday, SchoolClass } from "../../db";
import { toIsoDate } from "../../lib/dates";
import { formatClassName } from "../../lib/formatters";
import { lessonKey } from "../../lib/lessons";
import {
  getClassOccurrences,
  getHoliday,
  isSchoolClassActive,
  LESSONS_PER_DAY,
  WEEKDAY_NAMES,
} from "../../lib/schoolYear";
import { getClassColor } from "../../lib/subjectColors";
import { useLongPress } from "../../hooks/useLongPress";
import "./TimetableGrid.css";

type TimetableGridProps = {
  /** Monday of the displayed week. */
  monday: Date;
  schoolClasses: SchoolClass[];
  holidays: Holiday[];
  /** Days marked as "Ausfall", as `YYYY-MM-DD`. */
  cancelledDays: string[];
  /** Keys (see `lessonKey`) of single lessons marked as "Ausfall". */
  cancelledLessons: string[];
  /** Keys (see `lessonKey`) of lessons where every student has a symbol. */
  completedLessons: string[];
  /** Long press on the header of a non-holiday day, to toggle "Ausfall". */
  onDayLongPress: (date: Date) => void;
  /** Long press on a lesson, to toggle "Ausfall" for it. */
  onLessonLongPress: (date: Date, schoolClass: SchoolClass) => void;
};

type Slot = { day: number; weekday: string; date: Date };

/** Link props for creating a new class preset to a weekday and lesson. */
const newClassLink = ({ day, weekday, date }: Slot, hour: number) => ({
  to: `/classes/new?day=${day}&hour=${hour}&date=${toIsoDate(date)}`,
  "aria-label": `Neue Klasse am ${weekday}, ${hour}. Stunde`,
});

/**
 * Lesson-free block spanning `span` lessons from `hour` ("FREI", "FERIEN" or "FEIERTAG").
 * With a `slot`, dashed lesson cells on top still allow creating classes.
 */
function freeBlock(
  key: string,
  column: number,
  hour: number,
  span: number,
  label: string,
  slot?: Slot,
) {
  const nodes = [
    <div
      key={key}
      className="free-block flex items-center justify-center"
      style={{ gridColumn: column, gridRow: `${hour + 1} / span ${span}` }}
    >
      <span className="text-xs font-semibold tracking-[0.35em] text-brand-400">
        {label}
      </span>
    </div>,
  ];
  if (slot) {
    for (let h = hour; h < hour + span; h++) {
      nodes.push(
        <Link
          key={`${key}-${h}`}
          {...newClassLink(slot, h)}
          className="m-1 rounded-xl border border-dashed border-brand-300 transition-colors active:bg-brand-100/70"
          style={{ gridColumn: column, gridRow: h + 1 }}
        />,
      );
    }
  }
  return nodes;
}

type LessonTileProps = {
  schoolClass: SchoolClass;
  date: Date;
  isComplete: boolean;
  isCancelled: boolean;
  onLongPress: () => void;
};

/**
 * Timetable entry of a lesson, opening its classroom. Complete lessons show a check mark,
 * cancelled ones are grayed out and can only be restored by another long press.
 */
function LessonTile({
  schoolClass,
  date,
  isComplete,
  isCancelled,
  onLongPress,
}: LessonTileProps) {
  const pressHandlers = useLongPress(onLongPress);
  const className =
    "relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-xl border-l-4 px-3 py-1 select-none ";
  const texts = (
    <>
      <span className="truncate text-base leading-tight font-bold">
        {formatClassName(schoolClass)}
      </span>
      <span className="truncate text-sm leading-tight opacity-80">
        {schoolClass.subject}
      </span>
    </>
  );

  if (isCancelled) {
    return (
      <div
        className={`${className} border-gray-300 bg-gray-100 text-gray-400 line-through`}
        style={{ WebkitTouchCallout: "none" }}
        {...pressHandlers}
      >
        {texts}
        <span className="absolute right-2 bottom-1 text-[10px] font-semibold tracking-wider no-underline">
          AUSFALL
        </span>
      </div>
    );
  }
  const color = getClassColor(schoolClass);
  return (
    <Link
      to={`/classes/${schoolClass.id}?date=${toIsoDate(date)}`}
      draggable={false}
      className={`${className} shadow-tile transition-transform active:scale-[0.97]`}
      style={{
        background: color.background,
        borderColor: color.accent,
        color: color.text,
        WebkitTouchCallout: "none",
      }}
      {...pressHandlers}
    >
      {texts}
      {isComplete && (
        <span
          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: "#15803d" }}
          aria-label="Vollständig bewertet"
        >
          <CheckIcon size={13} strokeWidth={3} />
        </span>
      )}
    </Link>
  );
}

type DayHeaderProps = {
  weekday: string;
  date: Date;
  column: number;
  /** No lessons that day (holiday or "Ausfall"): the date is struck through. */
  isDayOff: boolean;
  onLongPress?: () => void;
};

/** Column header with weekday and date; a long press toggles "Ausfall" for the day. */
function DayHeader({
  weekday,
  date,
  column,
  isDayOff,
  onLongPress,
}: DayHeaderProps) {
  const pressHandlers = useLongPress(() => onLongPress?.());
  return (
    <div
      className={
        "flex flex-col items-center gap-0.5 bg-surface px-1 py-2 " +
        (onLongPress ? "transition-colors active:bg-brand-50" : "")
      }
      style={{ gridColumn: column, gridRow: 1, WebkitTouchCallout: "none" }}
      {...(onLongPress ? pressHandlers : {})}
    >
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">
        {weekday.slice(0, 2)}
      </span>
      <span
        className={
          "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-base font-semibold " +
          (isToday(date) ? "bg-brand-600 text-white " : "") +
          (isDayOff ? "line-through decoration-2 opacity-60" : "")
        }
      >
        {format(date, "d. MMM", { locale: de })}
      </span>
    </div>
  );
}

/**
 * Weekly timetable with one column per school day and one row per lesson.
 * Cells are placed explicitly so double lessons can span two rows.
 */
export function TimetableGrid({
  monday,
  schoolClasses,
  holidays,
  cancelledDays,
  cancelledLessons,
  completedLessons,
  onDayLongPress,
  onLessonLongPress,
}: TimetableGridProps) {
  const cells: ReactNode[] = [<div key="corner" className="bg-surface" />];

  for (let hour = 1; hour <= LESSONS_PER_DAY; hour++) {
    cells.push(
      <div
        key={`hour-${hour}`}
        className="flex items-center justify-center bg-surface text-sm font-semibold text-muted"
        style={{ gridColumn: 1, gridRow: hour + 1 }}
      >
        {hour}
      </div>,
    );
  }

  WEEKDAY_NAMES.forEach((weekday, index) => {
    const day = index + 1;
    const date = addDays(monday, index);
    const column = day + 1;
    const holiday = getHoliday(date, holidays);
    const isCancelled = cancelledDays.includes(toIsoDate(date));
    cells.push(
      <DayHeader
        key={`head-${day}`}
        weekday={weekday}
        date={date}
        column={column}
        isDayOff={isCancelled || !!holiday}
        // Holidays are fixed; only regular and cancelled days can be toggled
        onLongPress={holiday ? undefined : () => onDayLongPress(date)}
      />,
    );

    if (holiday) {
      const label = holiday.publicHoliday ? "FEIERTAG" : "FERIEN";
      cells.push(
        ...freeBlock(`holiday-${day}`, column, 1, LESSONS_PER_DAY, label),
      );
      return;
    }
    if (isCancelled) {
      cells.push(
        ...freeBlock(`cancelled-${day}`, column, 1, LESSONS_PER_DAY, "AUSFALL"),
      );
      return;
    }

    // Lesson blocks by start hour; a double lesson also covers the following hour
    const dayClasses = schoolClasses
      .flatMap(getClassOccurrences)
      .filter(
        (cls) => cls.day == day && isSchoolClassActive(cls, date, holidays),
      );
    const blocks = new Map<
      number,
      { span: number; schoolClasses: SchoolClass[] }
    >();
    for (let hour = 1; hour <= LESSONS_PER_DAY; hour++) {
      const starting = dayClasses.filter((cls) => cls.hour == hour);
      if (starting.length == 0) continue;
      const span = Math.min(
        starting.some((cls) => cls.double) ? 2 : 1,
        LESSONS_PER_DAY - hour + 1,
      );
      // Classes colliding with the second hour of a double lesson share its cell
      if (span == 2)
        starting.push(...dayClasses.filter((cls) => cls.hour == hour + 1));
      blocks.set(hour, { span, schoolClasses: starting });
      hour += span - 1;
    }
    const slot = { day, weekday, date };

    for (let hour = 1; hour <= LESSONS_PER_DAY; hour++) {
      const block = blocks.get(hour);
      if (block) {
        cells.push(
          <div
            key={`${day}-${hour}`}
            className="flex flex-col gap-1 bg-surface p-1"
            style={{
              gridColumn: column,
              gridRow: `${hour + 1} / span ${block.span}`,
            }}
          >
            {block.schoolClasses.map((cls) => {
              const key = lessonKey(cls.id, toIsoDate(date));
              return (
                <LessonTile
                  key={cls.id}
                  schoolClass={cls}
                  date={date}
                  isComplete={completedLessons.includes(key)}
                  isCancelled={cancelledLessons.includes(key)}
                  onLongPress={() => onLessonLongPress(date, cls)}
                />
              );
            })}
          </div>,
        );
        hour += block.span - 1;
        continue;
      }

      let end = hour;
      while (end < LESSONS_PER_DAY && !blocks.has(end + 1)) end++;
      cells.push(
        ...freeBlock(
          `free-${day}-${hour}`,
          column,
          hour,
          end - hour + 1,
          "FREI",
          slot,
        ),
      );
      hour = end;
    }
  });

  return (
    <div
      className="grid h-full gap-px overflow-hidden rounded-2xl border border-line bg-line"
      style={{
        gridTemplateColumns: "2.75rem repeat(5, minmax(0, 1fr))",
        gridTemplateRows: `auto repeat(${LESSONS_PER_DAY}, minmax(2.5rem, 1fr))`,
      }}
    >
      {cells}
    </div>
  );
}
