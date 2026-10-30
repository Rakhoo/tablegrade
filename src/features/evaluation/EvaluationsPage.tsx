import { Button } from "@mui/material";
import { Link, useLoaderData } from "react-router";
import { ChevronLeftIcon } from "../../components/icons";
import type { SchoolClass } from "../../db";
import { formatClassName, formatSchoolYear } from "../../lib/formatters";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { getClassColor } from "../../lib/subjectColors";
import type { EvaluationsLoaderData } from "./evaluationLoader";

/** Groups classes by school year and half, newest first, sorted by name within a group. */
function groupClasses(classes: SchoolClass[]) {
  const sorted = [...classes].sort(
    (a, b) =>
      b.year - a.year ||
      b.part.localeCompare(a.part) ||
      formatClassName(a).localeCompare(formatClassName(b), "de", {
        numeric: true,
      }) ||
      a.subject.localeCompare(b.subject, "de"),
  );
  const groups = new Map<string, SchoolClass[]>();
  for (const cls of sorted) {
    const title = `${formatSchoolYear(cls.year)} · ${SCHOOL_YEAR_PART_LABELS[cls.part]}`;
    groups.set(title, [...(groups.get(title) ?? []), cls]);
  }
  return [...groups];
}

/** Start page of the evaluation: one tile per class and school year half. */
export function EvaluationsPage() {
  const { schoolClasses } = useLoaderData<EvaluationsLoaderData>();

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center gap-3">
        <Button
          component={Link}
          to="/timetable"
          startIcon={<ChevronLeftIcon />}
          className="pl-2"
        >
          Stundenplan
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Auswertung</h1>
      </header>

      <main className="card min-h-0 flex-1 overflow-auto p-5">
        {schoolClasses.length == 0 && (
          <p className="text-muted">Noch keine Klassen angelegt.</p>
        )}
        {groupClasses(schoolClasses).map(([title, classes]) => (
          <section key={title} className="mb-6 last:mb-0">
            <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted uppercase">
              {title}
            </h2>
            <div className="grid grid-cols-4 gap-2 portrait:grid-cols-3">
              {classes.map((cls) => {
                const color = getClassColor(cls);
                return (
                  <Link
                    key={cls.id}
                    to={`/evaluations/${cls.id}`}
                    className="flex flex-col overflow-hidden rounded-xl border-l-4 px-3 py-2 shadow-tile transition-transform active:scale-[0.97]"
                    style={{
                      background: color.background,
                      borderColor: color.accent,
                      color: color.text,
                    }}
                  >
                    <span className="truncate text-base leading-tight font-bold">
                      {formatClassName(cls)}
                    </span>
                    <span className="truncate text-sm leading-tight opacity-80">
                      {cls.subject}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
