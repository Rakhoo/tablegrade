import type { ReactNode } from "react";
import type { SchoolClass } from "../db";
import { formatClassName } from "../lib/formatters";
import { ReturnButton } from "./ReturnButton";
import { SpeedDialLayout } from "./SpeedDial";

/** Where a page of a class was opened from, which decides its URL and way back. */
export type ClassOrigin = "classes" | "overview";

type ClassSubPageLayoutProps = {
  /** The class, `undefined` while a new one is created. */
  cls?: SchoolClass;
  origin: ClassOrigin;
  /** The lesson (`?date=`) the class was opened with, for the way back without history. */
  date: string | null;
  page: "edit" | "names";
  /** Asks before leaving the page by its back button or the speed dial, e.g. about unsaved input. */
  onLeave?: (leave: () => void) => void;
  children: ReactNode;
};

/**
 * Frame of the editor and the name cards of a class: a header with a real way back and the
 * title; the speed dial only holds the help and the settings.
 */
export function ClassSubPageLayout({
  cls,
  origin,
  date,
  page,
  onLeave,
  children,
}: ClassSubPageLayoutProps) {
  const query = date ? `?date=${date}` : "";
  return (
    <SpeedDialLayout entries={[]} guard={onLeave}>
      {/* Equal outer columns keep the title centered */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="justify-self-start">
          <ReturnButton
            fallback={
              cls ? `/${origin}/${cls.id}${query}` : `/timetable${query}`
            }
            onBack={onLeave}
          />
        </div>
        <div className="min-w-56 text-center">
          <div className="text-xl font-bold tracking-tight">
            {cls ? `${formatClassName(cls)} · ${cls.subject}` : "Neue Klasse"}
          </div>
          <div className="text-sm text-muted">
            {page == "names"
              ? "Namen lernen"
              : cls
                ? "Klasse bearbeiten"
                : "Angaben und Schülerliste"}
          </div>
        </div>
        {/* The right end stays free for the speed dial */}
        <div />
      </header>
      {children}
    </SpeedDialLayout>
  );
}
