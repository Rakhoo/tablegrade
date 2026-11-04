import { useLoaderData } from "react-router";
import { ClassSubPageLayout } from "../../components/ClassSubPageLayout";
import { NameTrainer } from "./NameTrainer";
import type { NameTrainerLoaderData } from "./nameTrainerLoader";

/** Page of the name cards of a class (`/classes/:id/names`, `/overview/:id/names`). */
export function NameTrainerPage() {
  const {
    origin,
    class: cls,
    students,
    date,
  } = useLoaderData<NameTrainerLoaderData>();
  return (
    <ClassSubPageLayout cls={cls} origin={origin} date={date} page="names">
      {/* A new round for another class */}
      <NameTrainer key={cls.id} students={students} />
    </ClassSubPageLayout>
  );
}
