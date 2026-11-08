import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { SpeedDialLayout } from "../../components/SpeedDial";
import { ReturnButton } from "../../components/ReturnButton";
import { resetEditHistory } from "../../hooks/useEditHistory";
import { AppearanceSettings } from "./AppearanceSettings";
import { BackupSettings } from "./BackupSettings";
import { DataSettings } from "./DataSettings";
import { GradingSettings } from "./GradingSettings";
import { LocationSettings } from "./LocationSettings";
import { SchoolSettings } from "./SchoolSettings";
import { SeatLayoutSettings } from "./SeatLayoutSettings";
import type { SettingsLoaderData } from "./settingsLoader";
import { TraitSettings } from "./TraitSettings";
import { paths } from "../../lib/paths";

/** Settings of the app, one card per topic; changes are saved right away. */
export function SettingsPage() {
  const { schoolClasses, traits } = useLoaderData<SettingsLoaderData>();
  // Settings can delete entries, which the undo history might restore
  useEffect(resetEditHistory, []);

  return (
    <SpeedDialLayout entries={[]}>
      <header className="flex items-center gap-3">
        <ReturnButton fallback={paths.timetable()} />
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        <LocationSettings schoolClasses={schoolClasses} />
        <AppearanceSettings />
        <GradingSettings />
        <TraitSettings traits={traits} />
        <SchoolSettings schoolClasses={schoolClasses} />
        <SeatLayoutSettings />
        <BackupSettings />
        <DataSettings />
      </main>
    </SpeedDialLayout>
  );
}
