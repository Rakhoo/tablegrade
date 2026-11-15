import { Tab, Tabs } from "@mui/material";
import { useEffect, type ReactNode } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { SpeedDialLayout } from "../../components/SpeedDial";
import { ReturnButton } from "../../components/ReturnButton";
import { resetEditHistory } from "../../hooks/useEditHistory";
import { AppearanceSettings } from "./AppearanceSettings";
import { BackupSettings } from "./BackupSettings";
import { DataSettings } from "./DataSettings";
import { DutySettings } from "./DutySettings";
import { GradeCalculationSettings } from "./GradeCalculationSettings";
import { GradeSymbolSettings } from "./GradeSymbolSettings";
import { LessonSettings } from "./LessonSettings";
import { LessonTimeSettings } from "./LessonTimeSettings";
import { LocationSettings } from "./LocationSettings";
import { PointSettings } from "./PointSettings";
import { SchoolSettings } from "./SchoolSettings";
import { SeatLayoutSettings } from "./SeatLayoutSettings";
import type { SettingsLoaderData } from "./settingsLoader";
import { TimetableSettings } from "./TimetableSettings";
import { TraitSettings } from "./TraitSettings";
import { paths } from "../../lib/paths";

/** The tabs of the settings, each with the cards of related topics. */
const TABS = [
  { key: "school", label: "Schule" },
  { key: "lessons", label: "Unterricht" },
  { key: "grading", label: "Benotung" },
  { key: "students", label: "Schüler" },
  { key: "display", label: "Darstellung" },
  { key: "data", label: "Daten und Export" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Settings of the app in tabs of related topics, one card per topic; changes are saved right
 * away. The tab is kept in the URL (`?tab=`), so going back or reloading stays on it.
 */
export function SettingsPage() {
  const { schoolClasses, traits, duties } = useLoaderData<SettingsLoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Settings can delete entries, which the undo history might restore
  useEffect(resetEditHistory, []);
  const tab: TabKey =
    TABS.find(({ key }) => key == searchParams.get("tab"))?.key ?? "school";

  const cards: Record<TabKey, ReactNode> = {
    school: (
      <>
        <LocationSettings schoolClasses={schoolClasses} />
        <SchoolSettings schoolClasses={schoolClasses} />
        <LessonTimeSettings />
      </>
    ),
    lessons: (
      <>
        <LessonSettings />
        <SeatLayoutSettings />
      </>
    ),
    grading: (
      <>
        <GradeSymbolSettings />
        <PointSettings />
        <GradeCalculationSettings />
      </>
    ),
    students: (
      <>
        <TraitSettings traits={traits} />
        <DutySettings duties={duties} />
      </>
    ),
    display: (
      <>
        <AppearanceSettings />
        <TimetableSettings />
      </>
    ),
    data: (
      <>
        <BackupSettings />
        <DataSettings />
      </>
    ),
  };

  return (
    <SpeedDialLayout entries={[]}>
      <header className="flex items-center gap-3">
        <ReturnButton fallback={paths.timetable()} />
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
      </header>
      <Tabs
        value={tab}
        onChange={(_, value: TabKey) =>
          setSearchParams({ tab: value }, { replace: true })
        }
        variant="scrollable"
        scrollButtons="auto"
        className="card shrink-0 px-2"
        data-help="Themen der Einstellungen; ein Tab zeigt seine Karten."
      >
        {TABS.map(({ key, label }) => (
          <Tab key={key} value={key} label={label} />
        ))}
      </Tabs>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        {cards[tab]}
      </main>
    </SpeedDialLayout>
  );
}
