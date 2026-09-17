import "./Calendar.css";
import { useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { StaticDatePicker } from "@mui/x-date-pickers";
import { de } from "date-fns/locale/de";
import { Button } from "@mui/material";

const daysOfWeek = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export default function Calendar() {
  const today = new Date();
  if (today.getDay() == 0 || today.getDay() == 6) {
    today.setDate(today.getDate() + 1 + (today.getDay() % 5));
  }
  const [currentDate, setCurrentDate] = useState(today);
  const innerCal = new Array<any[]>(11)
    .fill(new Array(6).fill(null))
    .map((value, outerIndex) =>
      value.map((_, innerIndex) => {
        const key = outerIndex + "-" + innerIndex;
        if (outerIndex == 0) {
          if (innerIndex == 0) return <div key={key}></div>;
          const date = new Date(currentDate);
          date.setDate(date.getDate() + (innerIndex - currentDate.getDay()));
          return (
            <div
              className={
                innerIndex == currentDate.getDay() ? "active" : undefined
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
          return <div key={key}>{outerIndex > 1 ? outerIndex - 1 : ""}</div>;
        }
        return <div key={key}>{outerIndex > 1 ? "event?" : "krank?"}</div>;
      }),
    )
    .flat();

  return (
    <div className="cal-wrapper h-screen flex flex-row justify-start gap-2">
      <div className="flex flex-col justify-start items-center w-min p-2">
        <Button variant="contained" onClick={() => setCurrentDate(new Date())}>
          Heute
        </Button>
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
          />
        </LocalizationProvider>
      </div>

      <div className="calendar w-full h-auto m-2 border rounded-lg grid grid-cols-6 divide-x-1 divide-y-1">
        {innerCal}
      </div>
    </div>
  );
}
