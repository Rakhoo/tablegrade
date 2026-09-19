import "./Calendar.css";
import { useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { StaticDatePicker } from "@mui/x-date-pickers";
import { de } from "date-fns/locale/de";
import { Button } from "@mui/material";
import { useLoaderData } from "react-router";

const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export function Calendar() {
  const today = new Date();
  if (today.getDay() == 0 || today.getDay() == 6) {
    today.setDate(today.getDate() + 1 + (today.getDay() % 5));
  }
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 3);
  maxDate.setMonth(11);
  maxDate.setDate(31);
  const [currentDate, setCurrentDate] = useState(today);
  const { holidays } = useLoaderData();
  const innerCal = new Array<any[]>(11)
    .fill(new Array(6).fill(null))
    .map((value, outerIndex) =>
      value.map((_, innerIndex) => {
        const key = outerIndex + "-" + innerIndex;
        const date = new Date(currentDate);
        date.setDate(date.getDate() + (innerIndex - currentDate.getDay()));

        if (outerIndex == 0) {
          if (innerIndex == 0) return <div key={key}></div>;
          return (
            <div
              className={
                innerIndex == currentDate.getDay()
                  ? "col-span-3 active"
                  : "col-span-3"
              }
              key={key}
            >
              <div>{daysOfWeek[innerIndex - 1]}</div>
              <div>
                {date.toLocaleDateString("de-DE", {
                  month: "2-digit",
                  day: "2-digit",
                })}
              </div>
            </div>
          );
        }
        if (innerIndex == 0) {
          return (
            <div
              key={key}
              className={outerIndex > 1 ? "row-span-2" : undefined}
            >
              {outerIndex > 1 ? outerIndex - 1 : ""}
            </div>
          );
        }
        if (
          holidays.find((holiday: any) => {
            const startsOn = new Date(holiday.start);
            startsOn.setMinutes(
              startsOn.getMinutes() + startsOn.getTimezoneOffset(),
            );
            const endsOn = new Date(holiday.end);
            endsOn.setDate(endsOn.getDate() + 1);
            endsOn.setMinutes(endsOn.getMinutes() + endsOn.getTimezoneOffset());
            return (
              startsOn.getTime() <= date.getTime() &&
              endsOn.getTime() > date.getTime()
            );
          })
        ) {
          return (
            <div
              key={key}
              className={
                outerIndex > 1 ? "col-span-3 row-span-2" : "col-span-3"
              }
            >
              frei
            </div>
          );
        }
        return (
          <div
            key={key}
            className={outerIndex > 1 ? "col-span-3 row-span-2" : "col-span-3"}
          >
            {outerIndex > 1 ? (
              <Button>event</Button>
            ) : (
              <Button variant="contained">frei</Button>
            )}
          </div>
        );
      }),
    )
    .flat();

  return (
    <div className="cal-wrapper h-screen flex flex-row max-lg:flex-col justify-start max-lg:items-center gap-2">
      <div className="flex flex-col justify-start items-center w-min p-2">
        <div className="flex flex-row justify-between gap-2">
          <Button variant="contained" onClick={() => setCurrentDate(today)}>
            Heute
          </Button>
          <Button variant="outlined">Klasse hinzufügen</Button>
        </div>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
          <StaticDatePicker
            displayStaticWrapperAs="desktop"
            value={currentDate}
            onChange={(value) => setCurrentDate(value || new Date())}
            onMonthChange={(month) => {
              if (
                month.getMonth() != currentDate.getMonth() ||
                month.getFullYear() != currentDate.getFullYear()
              ) {
                const today = new Date();
                if (
                  month.getMonth() == today.getMonth() &&
                  month.getFullYear() == today.getFullYear()
                ) {
                  if (today.getDay() == 0 || today.getDay() == 6) {
                    today.setDate(today.getDate() + 1 + (today.getDay() % 5));
                  }
                  setCurrentDate(today);
                } else {
                  if (month.getDay() == 0 || month.getDay() == 6) {
                    month.setDate(month.getDate() + 1 + (month.getDay() % 5));
                  }
                  setCurrentDate(month);
                }
              }
            }}
            shouldDisableDate={(day) => {
              const dayOfWeek = day.getDay();
              return dayOfWeek == 6 || dayOfWeek == 0;
            }}
            maxDate={maxDate}
            minDate={new Date("2026-08-02")}
          />
        </LocalizationProvider>
      </div>

      <div className="calendar w-full h-auto min-lg:m-2 max-lg:-mt-5 border rounded-lg bg-pink-50 grid grid-cols-16 divide-x-1 divide-y-1">
        {innerCal}
      </div>
    </div>
  );
}
