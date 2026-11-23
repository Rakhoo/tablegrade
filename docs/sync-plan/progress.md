# Fortschritt

Neueste Einträge oben. Format pro Lauf:

```
## <Datum, Uhrzeit UTC> · Stream <x> · <branch>
- Erledigt: …
- Entschieden: … (mit Grund)
- Nächster Schritt: …
```

Fertig-Meldungen als eigene Zeile: `**Stream <x> fertig**`.

---

## 2026-11-23, 13:30 UTC · Stream 0 · sync/foundation
- Erledigt: 0.1 (Branches `sync/integration` und `sync/foundation`, CLAUDE.md-Abschnitt),
  0.2 (Vitest, `src/test/sqliteDb.ts` mit `node:sqlite`, Smoke-Test),
  0.3 Audit, Migration 22 (UUIDs) mit Tests in `src/db/migrations.test.ts`.
- Audit IDs außerhalb der Schlüsselspalten:
  - `Settings`-JSON: keine IDs (`seatLayout` enthält Sitzplatz-Nummern, keine DB-IDs).
  - `localStorage`: keine IDs (Anzeige-Optionen, Einstellungs-Tab).
  - `sessionStorage`: `lib/returnPage.ts` (Schlüssel und Werte sind URLs mit Klassen-ID),
    `lib/mainPage.ts` (URLs der Hauptseiten, normalerweise ohne Klassen-ID).
  - URLs: `paths.ts` (`seating`, `table`, `edit`, `names` mit `id: number`), Loader mit
    `Number(params.id)` in overview, nameTrainer, classroom, classEdit; Regexe `\d+` in
    `returnPage.ts` `PAGE_NAMES`.
  - `lessonKey` in `lib/lessons.ts` (`classId|date`, nur im Speicher).
  - Sortierung nach ID als Ersatz für Anlage-Reihenfolge: `lib/lessons.ts` Z. 93 und 112.
  - `devData.ts` nutzt zurückgegebene IDs (`returning`), keine festen Werte.
  - Backup-Import: `importDatabase` führt `migrate` aus, also auch Migration 22.
  - `Holidays.id` bleibt Integer (Ferien-Cache, wird nicht synchronisiert).
- Entschieden: Migration 22 baut Tabellen als `*_new` neu, löscht alte Tabellen Kinder zuerst
  und benennt dann um. Grund: Migrationen laufen in einer Transaktion mit `foreign_keys = ON`,
  dort lässt sich das Pragma nicht abschalten; so greifen keine Kaskaden.
- Entschieden: Integer-IDs in `sessionStorage` (Rückweg) werden verworfen, nicht umgesetzt
  (beim TS-Umbau). Grund: Sie leben nur bis zum Schließen der App und haben einen Rückfall.
- Offen: Migration 22 ist committet, aber `schema.ts` und App-Code nutzen noch `number`.
  Der Branch ist bis zum TS-Umbau (nächste Aufgabe in 0.3) nicht lauffähig in der App.
- Nächster Schritt: 0.3 Drizzle-Schema auf `text`, Queries, Typen, Loader, `paths`, Rückweg,
  Sortierung in `lessons.ts` (Tie-Break nach ID durch stabile Alternative ersetzen).

