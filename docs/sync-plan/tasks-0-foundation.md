# Stream 0: Fundament

Branch: `sync/foundation`. Läuft allein, vor allen anderen Streams.
Ziel: Die App nutzt UUIDs, erfasst Änderungen in `_outbox`, das Protokoll ist verbindlich,
Server-Gerüst und CI stehen, `src/sync/` hat eine Fassade, gegen die Stream C bauen kann.

## 0.1 Branches und Regeln

- [x] `sync/integration` von `main` anlegen und pushen (falls nicht vorhanden).
- [x] `sync/foundation` von `sync/integration` anlegen.
- [x] In `CLAUDE.md` einen Abschnitt „Sync-Projekt (autonome Sessions)“ ergänzen: verweist auf
      `docs/sync-plan/README.md` Abschnitt 4 und 5, erlaubt dort das Committen, Pushen und
      Mergen nach `sync/integration`. Die Regel „Nur Mario merged nach main“ ausdrücklich
      nennen.

## 0.2 Testumgebung

- [x] `vitest` als Dev-Abhängigkeit, Skript `"test": "vitest run"`, Konfiguration für
      `src/**/*.test.ts` mit Node-Umgebung.
- [x] Hilfsmodul für Tests mit `node:sqlite` (in Node 22.5+ eingebaut, Node 24 ohne Flag):
      öffnet eine In-Memory-DB und führt `BASELINE` plus `MIGRATIONS` aus. Damit testen
      Stream 0 und B Migrationen, Trigger und die Sync-Engine ohne Browser.
- [x] Ein Smoke-Test, dass die heutige DB-Version entsteht.

## 0.3 Migration auf UUIDs

Betroffen: `Classes`, `Students`, `Grades`, `Traits`, `Duties` (Integer-Primärschlüssel) und
alle Tabellen mit Fremdschlüsseln darauf: `ClassStudents`, `StudentTraits`, `LessonTypes`,
`Reports`, `ReportGrades`, `CancelledLessons`, dazu `ClassStudents.dutyId`.

- [x] **Audit vorher:** Wo stehen IDs außerhalb dieser Spalten? Zu prüfen sind
      `Settings`-Werte (JSON), `localStorage` (z. B. `useDisplayOption`, Rückweg in
      `lib/returnPage.ts`), `lessonKey` in `lib/lessons.ts`, URLs (`lib/paths.ts`,
      `router.tsx`, Loader mit `Number(params…)`), Backup-Import, `devData.ts`.
      Ergebnis als Liste in progress.md.
- [x] Neue Migration (nur anhängen): Tabellen mit `TEXT`-Schlüsseln neu bauen, alte Integer
      über Zuordnungstabellen in UUID v4 umsetzen (in SQL aus `randomblob(16)` gebildet),
      Daten und Beziehungen vollständig übernehmen, `PRAGMA foreign_keys` beachten,
      `PRAGMA foreign_key_check` am Ende leer. Gespeicherte IDs in `Settings`-JSON mit umsetzen.
- [x] Tests mit `node:sqlite`: Beispieldaten auf alter Version anlegen, migrieren, alle
      Beziehungen und Kaskaden prüfen.
- [x] Drizzle-Schema auf `text` umstellen. Alle Queries, Typen (`number` → `string`),
      Loader, `paths`, Rückweg, Hilfsfunktionen anpassen. Neue IDs per
      `crypto.randomUUID()` beim Einfügen.
- [x] Gespeicherte Werte im `localStorage` mit alten IDs: beim Start verwerfen oder umsetzen
      (Entscheidung nach Audit, in progress.md begründen).
- [x] Alte Backups (Version ≤ vorher) importieren weiter, weil der Import die Migrationen
      ausführt. Prüfen und testen.
- [x] `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npm test` grün.

## 0.4 Änderungen erfassen

- [x] Neue Migration: Tabellen `_sync_state (key TEXT PRIMARY KEY, value TEXT)` und
      `_outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT, pk TEXT, changedAt INTEGER)`.
      `pk` ist JSON des Primärschlüssels.
- [x] Trigger für INSERT, UPDATE, DELETE auf allen synchronisierten Tabellen (Liste in
      protocol.md 4). Bedingung: `_sync_state.enabled = '1'` und `_sync_state.applying != '1'`.
      Gerätespezifische `Settings`-Schlüssel ausnehmen.
- [x] Gerätespezifische `Settings`-Schlüssel festlegen und in protocol.md eintragen.
- [x] Tests: Trigger feuern bei allen Operationen, auch bei Kaskaden-Löschungen über
      Fremdschlüssel. Feuern **nicht** bei `applying = '1'` und nicht bei `enabled != '1'`.

## 0.5 Protokoll verbindlich machen

- [x] protocol.md prüfen, Lücken schließen, Status auf „verbindlich“.
- [x] `server/testdata/vectors.json` mit Testvektoren: Wiederherstellungsschlüssel
      (Bytes ↔ Text, Prüfzeichen, Eingabe-Normalisierung), HKDF-Ableitungen, Wrap mit festem
      Nonce, Record-ID, Record-Verschlüsselung mit festem Nonce, Blob-ID, Prüfcode der
      Kopplung. Erzeugt per Skript `server/testdata/gen-vectors.mjs` (Node WebCrypto), Skript
      mit einchecken.

## 0.6 Fassade für den Client

- [x] `src/sync/index.ts` mit den öffentlichen Funktionen und Typen, die die UI braucht
      (z. B. `getSyncStatus`, `subscribeSyncStatus`, `startPasskeySignup`, `loginWithPasskey`,
      `startOidcLogin(provider)`, `unlockWithRecoveryKey`, `unlockWithPasskey`,
      `startDeviceLink`, `confirmDeviceLink`, `createRecoveryKey`, `listDevices`,
      `revokeDevice`, `enableSync`, `disableSync`, `logout`, `deleteAccount`).
      JSDoc an jeder Funktion. Implementierung vorerst als Stub mit `throw new Error("not implemented")`
      bzw. festen Beispielwerten hinter einem Schalter, damit Stream C die Oberfläche bauen kann.
- [x] Hook `src/hooks/useSyncStatus.ts` auf Basis der Fassade.

## 0.7 Server-Gerüst und CI

- [x] `server/go.mod` (Modul `github.com/Rakhoo/tablegrade/server`, aktuelle Go-Version),
      `cmd/notenfeder-server/main.go`: Konfiguration aus Umgebungsvariablen
      (`LISTEN_ADDR`, `DATA_DIR`, `APP_ORIGINS`, `RP_ID`, OIDC-Werte), `GET /api/v1/health`,
      sauberes Beenden.
- [x] Paketgerüst `internal/config`, `internal/store`, `internal/auth`, `internal/api`,
      `internal/hub`, `internal/blob` mit kurzen Paket-Kommentaren.
- [x] Ein Go-Test, der die Testvektoren aus `server/testdata/vectors.json` liest (erst nur
      Laden und Format prüfen; Stream A nutzt sie für die Server-seitigen Teile).
- [x] `.github/workflows/ci.yml`: bei Push und PR auf `sync/**` und `main`: Frontend
      (`tsc`, `lint`, `test`, `build`) und Server (`go vet`, `go test`). Der bestehende
      `deploy.yml` bleibt unverändert.
- [x] `server/README.md` als Gerüst (Zweck, lokale Entwicklung, Konfiguration).

## 0.8 Abschluss

- [x] **Merge-Punkt:** PR `sync/foundation` → `sync/integration`, grün, selbst mergen.
- [x] In progress.md: „Stream 0 fertig“. Damit starten A, B und C.
