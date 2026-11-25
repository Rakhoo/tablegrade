import { addDays, format, isSameDay, isToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { useLongPress } from "../../hooks/useLongPress";
import { toIsoDate } from "../../lib/dates";
import { getHoliday, type SchoolCalendar } from "../../lib/schoolYear";

type DayChipProps = {
  date: Date;
  selected: boolean;
  /** No lessons that day (holiday or "Ausfall"): the date is struck through. */
  isDayOff: boolean;
  onSelect: () => void;
  /** Long press toggles "Ausfall"; holidays have none. */
  onLongPress?: () => void;
};

/** One weekday with its date; today is marked, the selected day filled. */
function DayChip({
  date,
  selected,
  isDayOff,
  onSelect,
  onLongPress,
}: DayChipProps) {
  const pressHandlers = useLongPress(() => onLongPress?.());
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        "flex flex-1 flex-col items-center rounded-2xl py-1 transition-colors " +
        (selected
          ? "bg-brand-600 text-white shadow-tile"
          : isToday(date)
            ? "bg-brand-100 text-brand-700"
            : "bg-surface text-ink")
      }
      style={{ WebkitTouchCallout: "none" }}
      onClick={onSelect}
      {...(onLongPress ? pressHandlers : {})}
    >
      <span
        className={
          "text-[11px] font-semibold tracking-wider uppercase " +
          (selected ? "" : "text-muted")
        }
      >
        {format(date, "EEEEEE", { locale: de })}
      </span>
      <span
        className={
          "text-lg leading-tight font-bold " +
          (isDayOff ? "line-through decoration-2 opacity-60" : "")
        }
      >
        {format(date, "d")}
      </span>
    </button>
  );
}

type DayChipsProps = {
  monday: Date;
  selected: Date;
  calendar: SchoolCalendar;
  /** Days marked as "Ausfall", as `YYYY-MM-DD`. */
  cancelledDays: string[];
  onSelect: (date: Date) => void;
  /** Long press on a school day, to toggle "Ausfall". */
  onLongPress: (date: Date) => void;
};

/** The school days of a week as chips choosing the day the timetable shows on small screens. */
export function DayChips({
  monday,
  selected,
  calendar,
  cancelledDays,
  onSelect,
  onLongPress,
}: DayChipsProps) {
  return (
    <div
      className="flex gap-1.5"
      data-help="Tage der Woche: Antippen zeigt den Tag, lange drücken setzt Ausfall. Wischen über den Stundenplan wechselt den Tag."
    >
      {[0, 1, 2, 3, 4].map((offset) => {
        const date = addDays(monday, offset);
        const holiday = getHoliday(date, calendar);
        return (
          <DayChip
            key={offset}
            date={date}
            selected={isSameDay(date, selected)}
            isDayOff={!!holiday || cancelledDays.includes(toIsoDate(date))}
            onSelect={() => onSelect(date)}
            onLongPress={holiday ? undefined : () => onLongPress(date)}
          />
        );
      })}
    </div>
  );
}
