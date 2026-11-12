import { isValid, parseISO } from "date-fns";
import {
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { useState } from "react";
import { ClassSubPageLayout } from "../../components/ClassSubPageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  deleteSchoolClass,
  saveSchoolClass,
  type SchoolYearPart,
} from "../../db";
import { resetEditHistory } from "../../hooks/useEditHistory";
import { useGoBack } from "../../hooks/useGoBack";
import { paths } from "../../lib/paths";
import { getReturnPage } from "../../lib/returnPage";
import { ClassEditor } from "./ClassEditor";
import type { ClassEditLoaderData } from "./classEditLoader";

/**
 * Page of the class editor (`/classes/new`, `/classes/:id/edit`). Leaving a new class with input
 * asks first.
 */
export function ClassEditPage() {
  const {
    class: cls,
    roster,
    allClasses,
    subjects,
    calendar,
    schoolYears,
    traits,
    duties,
    date,
  } = useLoaderData<ClassEditLoaderData>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const presetDate =
    date && isValid(parseISO(date)) ? parseISO(date) : new Date();

  const [dirty, setDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  /** Leaves, after asking if that discards input of a new class. */
  const confirmLeave = (leave: () => void) => {
    if (dirty) setPendingLeave(() => leave);
    else leave();
  };
  /** Leaves the creation of a class. */
  const leave = useGoBack(paths.timetable());

  return (
    <ClassSubPageLayout
      cls={cls}
      date={date}
      page="edit"
      onLeave={confirmLeave}
    >
      <ClassEditor
        // A new state for another class, as the editor reads its props only once
        key={cls?.id ?? "new"}
        cls={cls}
        students={roster}
        allClasses={allClasses}
        subjects={subjects}
        calendar={calendar}
        schoolYears={schoolYears}
        traits={traits}
        duties={duties}
        preset={{
          day: Number(searchParams.get("day")) || undefined,
          hour: Number(searchParams.get("hour")) || undefined,
          date: presetDate,
          // From the overview selection, for the school year half the class is added to
          year: Number(searchParams.get("year")) || undefined,
          part:
            (searchParams.get("part") as SchoolYearPart | null) ?? undefined,
        }}
        onCancel={() => confirmLeave(leave)}
        onDirtyChange={setDirty}
        onLeave={confirmLeave}
        onSaved={() => {
          // Old steps could restore entries of removed students
          resetEditHistory();
          revalidate();
        }}
        onDelete={async () => {
          await deleteSchoolClass(cls!.id);
          // Back to the class list if opened from there, as all pages of the class are gone
          const { url } = getReturnPage(pathname, paths.timetable(date));
          navigate(/^\/classes\/\d/.test(url) ? paths.timetable(date) : url, {
            replace: true,
          });
        }}
        onCreate={async (form, students) => {
          const id = await saveSchoolClass(form, students);
          // Keep the lesson date from the timetable only if it fits the chosen weekday
          const keepDate =
            !!date &&
            (presetDate.getDay() == form.day ||
              presetDate.getDay() == form.day2);
          navigate(paths.seating(id, keepDate ? date : null), {
            replace: true,
          });
        }}
      />
      <ConfirmDialog
        open={!!pendingLeave}
        title="Neue Klasse verwerfen?"
        confirmLabel="Verwerfen"
        onClose={() => setPendingLeave(null)}
        onConfirm={() => pendingLeave?.()}
      >
        Die bisherigen Eingaben werden nicht gespeichert.
      </ConfirmDialog>
    </ClassSubPageLayout>
  );
}
