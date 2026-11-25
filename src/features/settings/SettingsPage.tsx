import { Tab, Tabs } from "@mui/material";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { SpeedDialLayout } from "../../components/SpeedDial";
import { ReturnButton } from "../../components/ReturnButton";
import { resetEditHistory } from "../../hooks/useEditHistory";
import { AppearanceSettings } from "./AppearanceSettings";
import { BackupSettings } from "./BackupSettings";
import { ControlSettings } from "./ControlSettings";
import { DataSettings } from "./DataSettings";
import { DevSettings } from "./DevSettings";
import { DutySettings } from "./DutySettings";
import { GradeCalculationSettings } from "./GradeCalculationSettings";
import { GradeColorSettings } from "./GradeColorSettings";
import { GradeSymbolSettings } from "./GradeSymbolSettings";
import { LessonSettings } from "./LessonSettings";
import { LessonTimeSettings } from "./LessonTimeSettings";
import { LocationSettings } from "./LocationSettings";
import { OverviewTableSettings } from "./OverviewTableSettings";
import { PointSettings } from "./PointSettings";
import { SchoolSettings } from "./SchoolSettings";
import { SeatLayoutSettings } from "./SeatLayoutSettings";
import type { SettingsLoaderData } from "./settingsLoader";
import { SyncSettings } from "./SyncSettings";
import { TimetableSettings } from "./TimetableSettings";
import { TraitSettings } from "./TraitSettings";
import { paths } from "../../lib/paths";
import { AttentionDot } from "../../components/AttentionDot";
import { useAttention } from "../../hooks/useAttention";
import { worstTone } from "../../lib/attention";

/** The tabs of the settings, each with the cards of related topics. */
const TABS = [
  { key: "sync", label: "Konto & Sync" },
  { key: "school", label: "Schule" },
  { key: "lessons", label: "Unterricht" },
  { key: "grading", label: "Benotung" },
  { key: "students", label: "Schüler" },
  { key: "display", label: "Darstellung" },
  { key: "data", label: "Daten und Export" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Taps on the active tab "Daten und Export" that unlock the developer options. */
const DEV_TAPS = 7;

/** Storage key of the tab used last, so the settings open on it again. */
const TAB_STORAGE_KEY = "settingsTab";

/** The tab with this key, if there is one. */
const findTab = (key: string | null) => TABS.find((tab) => tab.key == key)?.key;

/** The tab used last on this device, if any. */
function getStoredTab() {
  try {
    return findTab(localStorage.getItem(TAB_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/** Remembers the tab used last on this device. */
function storeTab(tab: TabKey) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // The settings then open on the first tab
  }
}

/**
 * Settings of the app in tabs of related topics, one card per topic; changes are saved right
 * away. The tab is kept in the URL (`?tab=`), so going back or reloading stays on it, and on
 * the device, so opening the settings again returns to the tab used last.
 */
export function SettingsPage() {
  const { schoolClasses, traits, duties } = useLoaderData<SettingsLoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Settings can delete entries, which the undo history might restore
  useEffect(resetEditHistory, []);
  // Unlocked only while the settings page is open
  const [devUnlocked, setDevUnlocked] = useState(false);
  const devTaps = useRef(0);
  const attention = useAttention();
  // Opens on the first tab with an open point; fixed at opening, so the tab does not jump
  // when a point gets done meanwhile
  const [openingTab] = useState(
    () => attention[0]?.tab ?? getStoredTab() ?? TABS[0].key,
  );
  const tab: TabKey = findTab(searchParams.get("tab")) ?? openingTab;

  /** Counts taps on the data tab while it is open; enough of them unlock the dev options. */
  const countDevTap = () => {
    if (tab != "data") {
      devTaps.current = 0;
      return;
    }
    devTaps.current++;
    if (devTaps.current < DEV_TAPS) return;
    setDevUnlocked(true);
  };

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
        <ControlSettings />
        <GradeColorSettings />
        <TimetableSettings />
        <OverviewTableSettings />
      </>
    ),
    data: (
      <>
        <BackupSettings />
        <DataSettings />
        {devUnlocked && <DevSettings />}
      </>
    ),
    sync: <SyncSettings />,
  };

  return (
    <SpeedDialLayout entries={[]}>
      <header className="flex items-center gap-3">
        <ReturnButton fallback={paths.timetable()} />
        <h1 className="text-xl font-bold tracking-tight">Einstellungen</h1>
      </header>
      <Tabs
        value={tab}
        onChange={(_, value: TabKey) => {
          storeTab(value);
          setSearchParams({ tab: value }, { replace: true });
        }}
        variant="scrollable"
        scrollButtons="auto"
        className="card shrink-0 px-2"
        data-help="Themen der Einstellungen; ein Tab zeigt seine Karten. Ein Punkt zeigt, dass dort etwas zu tun ist (gelb) oder etwas fehlgeschlagen ist (rot)."
      >
        {TABS.map(({ key, label }) => {
          const tone = worstTone(attention.filter((item) => item.tab == key));
          return (
            <Tab
              key={key}
              value={key}
              label={
                <span className="flex items-center gap-1.5">
                  {label}
                  {tone && <AttentionDot tone={tone} />}
                </span>
              }
              // Hidden: tapping the active data tab often enough shows the developer options
              onClick={key == "data" ? countDevTap : undefined}
            />
          );
        })}
      </Tabs>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-4">
        {cards[tab]}
      </main>
    </SpeedDialLayout>
  );
}
