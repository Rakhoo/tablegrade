import { Button, IconButton } from "@mui/material";
import { StaticDatePicker } from "@mui/x-date-pickers";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  getISOWeek,
  isSameMonth,
  isSameWeek,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";
import { de } from "date-fns/locale/de";
import { useMemo, useState } from "react";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import type { SchoolClass } from "../../db";
import { SpeedDialLayout } from "../../components/SpeedDial";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TableIcon,
} from "../../components/icons";
import { useRememberMainPage } from "../../hooks/useRememberMainPage";
import { rememberCurrentPageFor } from "../../lib/returnPage";
import { useSwipe } from "../../hooks/useSwipe";
import { getWeekStart, nextSchoolDay, toIsoDate } from "../../lib/dates";
import { lessonKey } from "../../lib/lessons";
import { CALENDAR_START, getCalendarEnd } from "../../lib/schoolYear";
import { CancelDialog } from "../../components/CancelDialog";
import { BackupReminder } from "./BackupReminder";
import { TimetableGrid } from "./TimetableGrid";
import type { TimetableLoaderData } from "./timetableLoader";
import "./TimetablePage.css";
import { paths } from "../../lib/paths";

/** Start page: week picker and the timetable of the selected week. */
export function TimetablePage() {
  const {
    calendar,
    cancelledDays,
    cancelledLessons,
    completedLessons,
    lessonTypes,
    schoolClasses,
  } = useLoaderData<TimetableLoaderData>();
  const { revalidate } = useRevalidator();
  useRememberMainPage("timetable");
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancelTarget, setCancelTarget] = useState<{
    date: Date;
    schoolClass?: SchoolClass;
  } | null>(null);

  const today = new Date();
  const dateParam = searchParams.get("date") ?? "";
  // The chosen day only anchors the calendar's visible month; the timetable shows its whole week.
  // Memoized: MUI re-syncs the visible month whenever it gets a new Date object.
  const anchor = useMemo(() => {
    const parsed = parseISO(dateParam);
    return isValid(parsed) ? parsed : nextSchoolDay(new Date());
  }, [dateParam]);
  const monday = getWeekStart(anchor);
  const selectDate = (date: Date) =>
    setSearchParams({ date: toIsoDate(date) }, { replace: true });
  /**
   * Selects a week via its Wednesday, so the calendar shows the month holding most of that
   * week when it spans two months.
   */
  const selectWeekAround = (weekStart: Date) =>
    selectDate(addDays(weekStart, 2));
  const maxDate = getCalendarEnd(
    Object.keys(calendar.secondHalfStarts).map(Number),
  );
  const newClassUrl = paths.newClass({ date: toIsoDate(monday) });

  /**
   * Selects the week for a month switched to in the calendar header: the current week in the
   * current month, otherwise the first school week of that month. MUI also reports month changes
   * caused by a new value, these match the anchor's month and are ignored.
   */
  const handleMonthChange = (month: Date) => {
    if (isSameMonth(month, anchor)) return;
    selectDate(
      isSameMonth(month, today) ? nextSchoolDay(today) : nextSchoolDay(month),
    );
  };

  /**
   * Selects the week of a tapped day. For days of the neighboring month the anchor stays in
   * the visible month, so tapping a grayed day does not flip the calendar.
   */
  const handleDayChange = (day: Date) => {
    if (isSameMonth(day, anchor)) return selectDate(day);
    const weekStart = getWeekStart(day);
    const inVisibleMonth = [0, 1, 2, 3, 4]
      .map((offset) => addDays(weekStart, offset))
      .find((weekday) => isSameMonth(weekday, anchor));
    selectDate(inVisibleMonth ?? day);
  };

  /** Switches to the previous or next week, within the calendar's limits. */
  const switchWeek = (direction: 1 | -1) => {
    const target = addWeeks(monday, direction);
    if (addDays(target, 4) >= CALENDAR_START && target <= maxDate) {
      selectWeekAround(target);
    }
  };

  /** Switches to the previous or next month, within the calendar's limits. */
  const switchMonth = (direction: 1 | -1) => {
    const target = addMonths(startOfMonth(anchor), direction);
    if (endOfMonth(target) >= CALENDAR_START && target <= maxDate) {
      handleMonthChange(target);
    }
  };

  const timetableSwipe = useSwipe(switchWeek);
  const calendarSwipe = useSwipe(switchMonth);

  /**
   * Marks all days of the selected week as one continuous pill. Today is highlighted softly,
   * or as a white dot inside the pill when it belongs to the selected week. Days of the
   * neighboring months are shown to complete the weeks, but grayed out.
   */
  const weekDayClass = (day: Date, isOutsideMonth: boolean) => {
    const base = "mx-0 w-10 border-0";
    const inWeek = isSameWeek(day, monday, { weekStartsOn: 1 });
    if (!inWeek) {
      if (isOutsideMonth) return `${base} opacity-40`;
      return isToday(day)
        ? `${base} bg-brand-100 font-semibold text-brand-700 hover:bg-brand-200`
        : base;
    }
    if (isOutsideMonth) {
      const outsideEdge =
        day.getDay() == 1
          ? "rounded-l-full"
          : day.getDay() == 5
            ? "rounded-r-full"
            : "";
      return `${base} rounded-none ${outsideEdge} bg-brand-300 font-semibold text-white/90 hover:bg-brand-400 focus:bg-brand-300`;
    }
    const edge =
      day.getDay() == 1
        ? "rounded-l-full"
        : day.getDay() == 5
          ? "rounded-r-full"
          : "";
    const todayDot = isToday(day)
      ? "bg-[radial-gradient(circle,white_0_15px,transparent_16px)] font-bold text-brand-700"
      : "text-white";
    return `${base} rounded-none ${edge} bg-brand-600 font-semibold ${todayDot} hover:bg-brand-700 focus:bg-brand-600`;
  };

  const weekBar = (
    <div
      className="flex items-center justify-between rounded-full bg-brand-50 p-1"
      data-help="Die gezeigte Woche; Pfeile oder Wischen über den Stundenplan wechseln sie."
    >
      <IconButton
        aria-label="Vorherige Woche"
        disabled={addDays(monday, -3) < CALENDAR_START}
        onClick={() => selectWeekAround(addWeeks(monday, -1))}
        className="bg-surface shadow-tile"
      >
        <ChevronLeftIcon />
      </IconButton>
      <div className="text-center leading-tight">
        <div className="font-semibold">KW {getISOWeek(monday)}</div>
        <div className="text-sm text-muted">
          {format(monday, "d. MMM", { locale: de })} –{" "}
          {format(addDays(monday, 4), "d. MMM yyyy", { locale: de })}
        </div>
      </div>
      <IconButton
        aria-label="Nächste Woche"
        disabled={addWeeks(monday, 1) > maxDate}
        onClick={() => selectWeekAround(addWeeks(monday, 1))}
        className="bg-surface shadow-tile"
      >
        <ChevronRightIcon />
      </IconButton>
    </div>
  );

  return (
    <SpeedDialLayout
      entries={[]}
      className="timetable-page gap-4 portrait:flex-col"
    >
      {/* Landscape: a column on the left with the controls above the calendar, the week bar above
          the timetable; portrait: above the timetable with controls (week bar included) and
          calendar side by side to save height, the calendar lower so the speed dial in the top
          right corner covers nothing. */}
      <aside
        className="card flex shrink-0 gap-3 px-3 landscape:w-[22rem] landscape:flex-col landscape:items-center landscape:pt-4 portrait:justify-center portrait:py-3"
        data-help-group
        data-help="Wochenauswahl, neue Klassen und die Übersichten."
      >
        <div className="flex flex-col gap-3 px-3 landscape:w-full portrait:w-80 portrait:shrink-0">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Stundenplan</h1>
            <Button
              variant="outlined"
              size="small"
              // Without a date the current week is shown, the clean start state
              onClick={() => setSearchParams({}, { replace: true })}
              data-help="Springt zurück zur aktuellen Woche."
            >
              Heute
            </Button>
          </div>

          <div className="landscape:hidden">{weekBar}</div>

          <div className="flex flex-col gap-2">
            <Button
              component={Link}
              to={newClassUrl}
              onClick={() => rememberCurrentPageFor(paths.newClass())}
              variant="contained"
              startIcon={<PlusIcon size={18} />}
              className="flex-1 whitespace-nowrap"
              data-help="Legt eine Klasse mit Fach, Stunden und Schülerliste an."
            >
              Neue Klasse
            </Button>
            <Button
              component={Link}
              to={paths.classes()}
              variant="outlined"
              startIcon={<TableIcon size={18} />}
              className="flex-1 whitespace-nowrap"
              data-help="Alle Klassen mit ihren Notentabellen."
            >
              Übersichten
            </Button>
          </div>
        </div>

        {/* Portrait: lower, so the speed dial above it covers nothing */}
        <div
          {...calendarSwipe}
          className="touch-pan-y portrait:mt-12"
          data-help="Ein Tag wählt seine Woche; Wischen wechselt den Monat."
        >
          <StaticDatePicker
            displayStaticWrapperAs="desktop"
            value={anchor}
            onChange={(value) => value && handleDayChange(value)}
            showDaysOutsideCurrentMonth
            onMonthChange={handleMonthChange}
            slotProps={{
              day: ({ day, isDayOutsideMonth }) => ({
                className: weekDayClass(day, isDayOutsideMonth),
              }),
            }}
            shouldDisableDate={(day) => day.getDay() == 6 || day.getDay() == 0}
            minDate={CALENDAR_START}
            maxDate={maxDate}
          />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-h-11 items-center justify-center pr-28 portrait:hidden">
          <div className="w-80">{weekBar}</div>
        </div>
        <section
          {...timetableSwipe}
          className="card relative min-h-0 flex-1 touch-pan-y p-3"
          data-help="Eine Stunde öffnet ihren Sitzplan, ein freies Feld legt eine Klasse an; lange drücken setzt Ausfall. ✓ = vollständig bewertet."
        >
          <TimetableGrid
            monday={monday}
            schoolClasses={schoolClasses}
            calendar={calendar}
            cancelledDays={cancelledDays}
            cancelledLessons={cancelledLessons}
            completedLessons={completedLessons}
            lessonTypes={lessonTypes}
            onDayLongPress={(date) => setCancelTarget({ date })}
            onLessonLongPress={(date, schoolClass) =>
              setCancelTarget({ date, schoolClass })
            }
          />
        </section>
      </div>

      <BackupReminder />

      {cancelTarget && (
        <CancelDialog
          date={cancelTarget.date}
          schoolClass={cancelTarget.schoolClass}
          isCancelled={
            cancelTarget.schoolClass
              ? cancelledLessons.includes(
                  lessonKey(
                    cancelTarget.schoolClass.id,
                    toIsoDate(cancelTarget.date),
                  ),
                )
              : cancelledDays.includes(toIsoDate(cancelTarget.date))
          }
          onClose={() => setCancelTarget(null)}
          onChanged={revalidate}
        />
      )}
    </SpeedDialLayout>
  );
}
