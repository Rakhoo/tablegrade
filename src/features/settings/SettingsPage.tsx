import { Button } from "@mui/material";
import { Link, useLoaderData } from "react-router";
import { ChevronLeftIcon } from "../../components/icons";
import { AppearanceSettings } from "./AppearanceSettings";
import { DataSettings } from "./DataSettings";
import { GradingSettings } from "./GradingSettings";
import { LocationSettings } from "./LocationSettings";
import { SchoolSettings } from "./SchoolSettings";
import { SeatLayoutSettings } from "./SeatLayoutSettings";
import type { SettingsLoaderData } from "./settingsLoader";
import { TraitSettings } from "./TraitSettings";

/** Settings of the app, one card per topic; changes are saved right away. */
export function SettingsPage() {
  const { schoolClasses, traits } = useLoaderData<SettingsLoaderData>();

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
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        <LocationSettings schoolClasses={schoolClasses} />
        <AppearanceSettings />
        <GradingSettings />
        <TraitSettings traits={traits} />
        <SchoolSettings schoolClasses={schoolClasses} />
        <SeatLayoutSettings />
        <DataSettings />
      </main>
    </div>
  );
}
