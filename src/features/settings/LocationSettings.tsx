import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TrashIcon } from "../../components/icons";
import {
  deleteEntries,
  deleteSchoolClass,
  deleteSchoolYear,
  getAllGrades,
  getHolidays,
  saveSchoolYear,
  saveSettings,
  type SchoolClass,
} from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { formatSchoolYear } from "../../lib/formatters";
import { getOrphanedEntries } from "../../lib/lessons";
import {
  createCalendar,
  FIRST_SCHOOL_YEAR,
  getDefaultSecondHalfStart,
  getBaseLastSchoolYear,
} from "../../lib/schoolYear";
import { FEDERAL_STATES } from "../../lib/settings";
import type { RootLoaderData } from "../../rootLoader";
import {
  fetchHolidays,
  fetchLastSchoolYear,
  storeHolidays,
} from "../../services/holidays";
import { SettingsSection } from "./SettingsSection";

type SchoolYear = RootLoaderData["schoolYears"][number];

/** A planned change of state or school years, waiting for its confirmation if it deletes data. */
type PendingChange = {
  state: string;
  years: SchoolYear[];
  holidays: Awaited<ReturnType<typeof getHolidays>>;
  orphanIds: number[];
  removedClasses: SchoolClass[];
};

type LocationSettingsProps = { schoolClasses: SchoolClass[] };

/**
 * Federal state and school years with the start of their second half. Changes can move
 * entries out of their lesson; these are deleted after a double confirmation.
 */
export function LocationSettings({ schoolClasses }: LocationSettingsProps) {
  const settings = useSettings();
  const { schoolYears } = useRouteLoaderData("root") as RootLoaderData;
  const { revalidate } = useRevalidator();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [newYear, setNewYear] = useState<number | "">("");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lastSchoolYear, setLastSchoolYear] = useState(getBaseLastSchoolYear);

  useEffect(() => {
    // Offline the assumed year stays, which is fine for an offer
    fetchLastSchoolYear(settings.federalState)
      .then(setLastSchoolYear)
      .catch(() => undefined);
  }, [settings.federalState]);

  const usedYears = schoolYears.map(({ year }) => year);
  // Newest first, as older years are the exception
  const freeYears = Array.from(
    { length: lastSchoolYear - FIRST_SCHOOL_YEAR + 1 },
    (_, index) => lastSchoolYear - index,
  ).filter((year) => !usedYears.includes(year));

  const commit = async ({
    state,
    years,
    holidays,
    orphanIds,
    removedClasses,
  }: PendingChange) => {
    const kept = years.map(({ year }) => year);
    for (const cls of removedClasses) await deleteSchoolClass(cls.id);
    if (orphanIds.length > 0) await deleteEntries(orphanIds);
    for (const { year } of schoolYears) {
      if (!kept.includes(year)) await deleteSchoolYear(year);
    }
    for (const { year, secondHalfStart } of years) {
      await saveSchoolYear(year, secondHalfStart);
    }
    await saveSettings({ federalState: state });
    await storeHolidays(holidays, state, kept);
    setDrafts({});
    await revalidate();
  };

  /** Checks what a new state or new school years would delete, and asks if there is anything. */
  const requestChange = async (state: string, years: SchoolYear[]) => {
    setBusy(true);
    setError(null);
    try {
      const sorted = [...years].sort((a, b) => a.year - b.year);
      const kept = sorted.map(({ year }) => year);
      const sameYears = kept.join() == usedYears.join();
      const holidays =
        state == settings.federalState && sameYears
          ? await getHolidays()
          : await fetchHolidays(state, kept);
      const removedClasses = schoolClasses.filter(
        (cls) => !kept.includes(cls.year),
      );
      const orphans = getOrphanedEntries(
        await getAllGrades(),
        schoolClasses.filter((cls) => kept.includes(cls.year)),
        createCalendar(holidays, sorted),
      );
      const change = {
        state,
        years: sorted,
        holidays,
        orphanIds: orphans.map((entry) => entry.id),
        removedClasses,
      };
      if (orphans.length > 0 || removedClasses.length > 0) {
        setAcknowledged(false);
        setPending(change);
      } else {
        await commit(change);
      }
    } catch (failure) {
      console.error(failure);
      setError(
        "Die Ferien konnten nicht geladen werden. Dafür wird eine Internetverbindung gebraucht.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Bundesland und Schuljahre"
      hint="Änderungen können Halbjahresgrenzen und Ferien verschieben. Einträge, die dadurch außerhalb ihrer Stunden liegen, werden nach Bestätigung gelöscht."
    >
      {error && <Alert severity="error">{error}</Alert>}
      {settings.holidayCache?.provisional && (
        <Alert severity="info">
          Für das letzte Schuljahr gibt es noch keine Sommerferien-Termine. Bis
          dahin gilt eine Schätzung, die automatisch ersetzt wird.
        </Alert>
      )}
      <TextField
        select
        label="Bundesland"
        value={settings.federalState}
        disabled={busy}
        onChange={(event) => requestChange(event.target.value, schoolYears)}
      >
        {FEDERAL_STATES.map(({ slug, name }) => (
          <MenuItem key={slug} value={slug}>
            {name}
          </MenuItem>
        ))}
      </TextField>

      {schoolYears.map(({ year, secondHalfStart }) => {
        const draft = drafts[year] ?? secondHalfStart;
        return (
          <div key={year} className="flex items-center gap-2">
            <span className="w-20 font-semibold">{formatSchoolYear(year)}</span>
            <TextField
              type="date"
              size="small"
              label="Beginn 2. Halbjahr"
              value={draft}
              onChange={(event) =>
                setDrafts({ ...drafts, [year]: event.target.value })
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  min: `${year + 1}-01-01`,
                  max: `${year + 1}-03-31`,
                },
              }}
            />
            {draft != secondHalfStart && draft && (
              <Button
                variant="contained"
                size="small"
                disabled={busy}
                onClick={() =>
                  requestChange(
                    settings.federalState,
                    schoolYears.map((other) =>
                      other.year == year
                        ? { year, secondHalfStart: draft }
                        : other,
                    ),
                  )
                }
              >
                Übernehmen
              </Button>
            )}
            <IconButton
              color="error"
              aria-label={`${formatSchoolYear(year)} entfernen`}
              disabled={busy}
              onClick={() =>
                requestChange(
                  settings.federalState,
                  schoolYears.filter((other) => other.year != year),
                )
              }
              className="ml-auto"
            >
              <TrashIcon size={18} />
            </IconButton>
          </div>
        );
      })}

      {freeYears.length > 0 && (
        <div className="flex items-center gap-2">
          <TextField
            select
            size="small"
            label="Schuljahr"
            value={newYear}
            onChange={(event) => setNewYear(Number(event.target.value))}
            className="min-w-36"
          >
            {freeYears.map((year) => (
              <MenuItem key={year} value={year}>
                {formatSchoolYear(year)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={newYear == "" || busy}
            onClick={() => {
              const year = Number(newYear);
              setNewYear("");
              requestChange(settings.federalState, [
                ...schoolYears,
                { year, secondHalfStart: getDefaultSecondHalfStart(year) },
              ]);
            }}
          >
            Jahr hinzufügen
          </Button>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          title="Einträge löschen?"
          confirmLabel="Ändern und löschen"
          confirmDisabled={!acknowledged}
          onClose={() => setPending(null)}
          onConfirm={() => commit(pending)}
        >
          <p className="mb-2">
            Durch diese Änderung werden unwiderruflich gelöscht:
            {pending.orphanIds.length > 0 &&
              ` ${pending.orphanIds.length} Einträge, die außerhalb ihrer Stunden liegen.`}
            {pending.removedClasses.length > 0 &&
              ` ${pending.removedClasses.length} Klassen des entfernten Schuljahres mit allen Noten.`}
          </p>
          <FormControlLabel
            className="rounded-2xl bg-red-50 py-1 pr-3 text-gray-900"
            control={
              <Checkbox
                color="error"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
            }
            label="Ich bestätige, dass diese Daten gelöscht werden."
          />
        </ConfirmDialog>
      )}
    </SettingsSection>
  );
}
