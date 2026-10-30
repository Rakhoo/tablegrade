import { Button, IconButton } from "@mui/material";
import { StaticDatePicker } from "@mui/x-date-pickers";
import {
  addDays,
  addWeeks,
  addYears,
  endOfYear,
  format,
  getISOWeek,
  isSameMonth,
  isSameWeek,
  isToday,
  isValid,
  parseISO,
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TableIcon,
} from "../../components/icons";
import { getWeekStart, nextSchoolDay, toIsoDate } from "../../lib/dates";
import { lessonKey } from "../../lib/lessons";
import { AppMenu } from "./AppMenu";
import { CancelDialog } from "./CancelDialog";
import { TimetableGrid } from "./TimetableGrid";
import type { TimetableLoaderData } from "./timetableLoader";
import "./TimetablePage.css";

const MIN_DATE = new Date(2026, 7, 2);

/** Start page: week picker and the timetable of the selected week. */
export function TimetablePage() {
  const {
    holidays,
    cancelledDays,
    cancelledLessons,
    completedLessons,
    schoolClasses,
  } = useLoaderData<TimetableLoaderData>();
  const { revalidate } = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancelTarget, setCancelTarget] = useState<{
    date: Date;
    schoolClass?: SchoolClass;
  } | null>(null);

  const today = new Date();
  const thisWeek = getWeekStart(nextSchoolDay(today));
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
  const maxDate = endOfYear(addYears(thisWeek, 3));
  const newClassUrl = `/classes/new?date=${toIsoDate(monday)}`;

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

  return (
    <div className="timetable-page flex h-full gap-4 p-4 portrait:flex-col">
      {/* Landscape: controls above the calendar; portrait: side by side to save height */}
      <aside className="card flex shrink-0 gap-3 px-3 landscape:w-[22rem] landscape:flex-col landscape:items-center landscape:pt-5 portrait:justify-center portrait:py-3">
        {/* Portrait: aligned to the calendar's top, so the title is level with the month label */}
        <div className="flex flex-col gap-3 px-3 landscape:w-full portrait:w-80 portrait:shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Stundenplan</h1>
            <div className="flex gap-2">
              <Button
                variant="outlined"
                size="small"
                // Without a date the current week is shown, the clean start state
                onClick={() => setSearchParams({}, { replace: true })}
              >
                Heute
              </Button>
              <AppMenu />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-full bg-brand-50 p-1">
            <IconButton
              aria-label="Vorherige Woche"
              disabled={addDays(monday, -3) < MIN_DATE}
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

          <Button
            component={Link}
            to={newClassUrl}
            variant="contained"
            size="large"
            startIcon={<PlusIcon />}
          >
            Neue Klasse
          </Button>
          <Button
            component={Link}
            to="/evaluations"
            variant="outlined"
            size="large"
            startIcon={<TableIcon />}
          >
            Auswertung
          </Button>
        </div>

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
          minDate={MIN_DATE}
          maxDate={maxDate}
        />
      </aside>

      <section className="card relative min-h-0 flex-1 p-3">
        <TimetableGrid
          monday={monday}
          schoolClasses={schoolClasses}
          holidays={holidays}
          cancelledDays={cancelledDays}
          cancelledLessons={cancelledLessons}
          completedLessons={completedLessons}
          onDayLongPress={(date) => setCancelTarget({ date })}
          onLessonLongPress={(date, schoolClass) =>
            setCancelTarget({ date, schoolClass })
          }
        />
      </section>

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
    </div>
  );
}
