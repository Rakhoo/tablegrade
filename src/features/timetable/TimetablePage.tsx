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
import { useState } from "react";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "../../components/icons";
import { getWeekStart, nextSchoolDay, toIsoDate } from "../../lib/dates";
import { BackupMenu } from "./BackupMenu";
import { CancelDayDialog } from "./CancelDayDialog";
import { TimetableGrid } from "./TimetableGrid";
import type { TimetableLoaderData } from "./timetableLoader";
import "./TimetablePage.css";

const MIN_DATE = new Date(2026, 7, 2);

/** Start page: week picker and the timetable of the selected week. */
export function TimetablePage() {
  const { holidays, cancelledDays, schoolClasses } =
    useLoaderData<TimetableLoaderData>();
  const { revalidate } = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancelTarget, setCancelTarget] = useState<Date | null>(null);

  const today = new Date();
  const thisWeek = getWeekStart(nextSchoolDay(today));
  const param = parseISO(searchParams.get("date") ?? "");
  // The chosen day only anchors the calendar's visible month; the timetable shows its whole week
  const anchor = isValid(param) ? param : nextSchoolDay(today);
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
   * Marks all days of the selected week as one continuous pill. Today is highlighted softly,
   * or as a white dot inside the pill when it belongs to the selected week.
   */
  const weekDayClass = (day: Date) => {
    const base = "mx-0 w-10 border-0";
    const inWeek = isSameWeek(day, monday, { weekStartsOn: 1 });
    if (!inWeek) {
      return isToday(day)
        ? `${base} bg-brand-100 font-semibold text-brand-700 hover:bg-brand-200`
        : base;
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
      <aside className="card flex shrink-0 flex-col items-center gap-3 px-3 pt-5 landscape:w-[22rem] portrait:pt-4">
        <div className="flex w-full items-center justify-between gap-3 px-3">
          <h1 className="text-2xl font-bold tracking-tight">Stundenplan</h1>
          <div className="flex gap-2">
            <Button
              variant="outlined"
              size="small"
              onClick={() => selectDate(nextSchoolDay(today))}
            >
              Heute
            </Button>
            <Button
              component={Link}
              to={newClassUrl}
              variant="contained"
              size="small"
              startIcon={<PlusIcon size={18} />}
              className="landscape:hidden"
            >
              Neue Klasse
            </Button>
            <BackupMenu />
          </div>
        </div>

        <div className="flex w-[calc(100%-1.5rem)] items-center justify-between rounded-full bg-brand-50 p-1 portrait:max-w-sm">
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
          className="w-[calc(100%-1.5rem)] portrait:hidden"
        >
          Neue Klasse
        </Button>

        <StaticDatePicker
          displayStaticWrapperAs="desktop"
          value={anchor}
          onChange={(value) => value && selectDate(value)}
          onMonthChange={handleMonthChange}
          slotProps={{ day: ({ day }) => ({ className: weekDayClass(day) }) }}
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
          onDayLongPress={setCancelTarget}
        />
      </section>

      {cancelTarget && (
        <CancelDayDialog
          date={cancelTarget}
          isCancelled={cancelledDays.includes(toIsoDate(cancelTarget))}
          onClose={() => setCancelTarget(null)}
          onChanged={revalidate}
        />
      )}
    </div>
  );
}
