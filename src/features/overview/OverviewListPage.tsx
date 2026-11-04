import { Link, useLoaderData } from "react-router";
import { SpeedDialLayout } from "../../components/SpeedDial";
import { BackButton } from "../../components/BackButton";
import { PlusIcon } from "../../components/icons";
import type { SchoolClass } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { formatClassName, formatSchoolYear } from "../../lib/formatters";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { getClassColor } from "../../lib/subjectColors";
import { useRememberMainPage } from "../../hooks/useRememberMainPage";
import { rememberCurrentPageFor } from "../../lib/returnPage";
import type { OverviewListLoaderData } from "./overviewLoader";

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
  return [...groups].map(([title, group]) => ({
    title,
    year: group[0].year,
    part: group[0].part,
    classes: group,
  }));
}

/** Start page of the overview: one tile per class and school year half. */
export function OverviewListPage() {
  const { schoolClasses } = useLoaderData<OverviewListLoaderData>();
  const { levels } = useSettings();
  useRememberMainPage("overview");

  return (
    <SpeedDialLayout entries={[]}>
      <header className="flex items-center gap-3">
        <BackButton target="timetable" />
        <h1 className="text-xl font-bold tracking-tight">Übersichten</h1>
      </header>

      <main
        className="card min-h-0 flex-1 overflow-auto p-5"
        data-help="Alle Klassen nach Schuljahr und Halbjahr; eine Klasse öffnet ihre Übersichtstabelle mit allen Stunden und Noten."
      >
        {schoolClasses.length == 0 && (
          <p className="text-muted">Noch keine Klassen angelegt.</p>
        )}
        {groupClasses(schoolClasses).map(({ title, year, part, classes }) => (
          <section key={title} className="mb-6 last:mb-0">
            <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted uppercase">
              {title}
            </h2>
            <div className="grid grid-cols-4 gap-2 portrait:grid-cols-3">
              {classes.map((cls) => {
                const color = getClassColor(cls, levels);
                return (
                  <Link
                    key={cls.id}
                    to={`/overview/${cls.id}`}
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
              <Link
                to={`/classes/new?year=${year}&part=${part}`}
                onClick={() => rememberCurrentPageFor("/classes/new")}
                className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 transition-transform active:scale-[0.97]"
                data-help="Legt eine Klasse in diesem Schuljahr und Halbjahr an."
              >
                <PlusIcon size={18} />
                Neue Klasse
              </Link>
            </div>
          </section>
        ))}
      </main>
    </SpeedDialLayout>
  );
}
