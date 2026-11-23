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

## 2026-11-23, 16:20 UTC · Stream A · sync/server
- Erledigt: A3 Passkeys (`internal/api/passkey.go`): Registrierung (neues Konto oder weiterer
  Passkey mit Sitzung), Login mit discoverable credentials, PRF-Salt in den Optionen,
  `prfCapable` aus `clientExtensionResults`, Challenges 5 Minuten und einmalig
  (`auth.Challenges`, im Speicher). Tests mit Software-Authenticator (ES256, `none`).
- Entschieden: `go-webauthn` v0.15.0, weil neuere Versionen Go 1.25+ verlangen. `go.mod` bleibt
  bei `go 1.24.0`.
- Entschieden: WebAuthn-User-ID = `userId`. Die ID wird bei `register/begin` gewählt, das Konto
  erst bei `finish` angelegt (`store.CreateUserWithID`). Grund: Die Bibliothek prüft beim Login,
  dass `userHandle` zur Kontokennung passt.
- Entschieden: Challenges im Speicher statt in der DB. Ein Neustart bricht nur laufende
  Anmeldungen ab.
- Protokoll ergänzt (Abschnitt „Änderungen“, Passkeys): Body von `begin`, `204` bei weiterem
  Passkey, PRF-Salt schon in den Optionen, Fehlercodes. Betrifft Stream B.
- `api.New` gibt jetzt auch einen Fehler zurück (ungültige WebAuthn-Konfiguration).
- Ungetestet: echte Authenticatoren (iPad, Windows Hello). Erst mit Stream D/Mario.
- Nächster Schritt: A4 Microsoft und Google.

## 2026-11-23, 15:45 UTC · Stream A · sync/server
- Erledigt: A1 (Store-Interface, SQLite-Umsetzung `internal/store/sqlite`, gemeinsame Tests
  `internal/store/storetest` inkl. parallelem Push), A2 (Server-Struktur `api.New`, Fehlerformat,
  Sitzungen mit Token-Hash und 90-Tage-Verlängerung, `session_revoked`, Rate-Limit pro IP für
  `auth`, Body-Limit 64 KB, Test-Login mit `DEV_AUTH=1`, `GET /auth/session`, `POST /auth/logout`,
  Geräte-Endpunkte, max. 10 aktive Geräte).
- Entschieden: `modernc.org/sqlite` v1.46.1, weil neuere Versionen Go 1.26 verlangen (lokal und
  im Plan ist Go 1.24). Grund: `go.mod` bleibt bei `go 1.24.0`.
- Entschieden: Eigene Seq-Spalte `users.latest_seq`; eine Schreib-Verbindung mit `BEGIN IMMEDIATE`
  serialisiert Pushes. Blob-Referenzen in `record_blobs`, `blobs.orphaned_at` startet die 30 Tage.
- Entschieden: Sitzung wird höchstens einmal pro Minute verlängert (spart Schreibzugriffe).
- Entschieden: `TRUST_FORWARDED_FOR=1` hinter Tailscale Funnel, sonst zählen alle Anfragen als
  127.0.0.1. Rate-Limit für `push` und Größenlimits für Push/Blobs folgen mit A6/A7.
- Protokoll ergänzt (Abschnitt „Änderungen“): Code `internal`, Test-Login, Form von
  `GET /auth/session`, `204`-Antworten, Gerätenamen 1–80 Zeichen. Betrifft Stream B.
- Nächster Schritt: A3 Passkeys (`go-webauthn`).

## 2026-11-23, 15:20 UTC · Stream B · sync/client
- Erledigt: B1 Krypto in `src/crypto/` (`encoding`, `primitives`, `keys`, `recoveryKey`,
  `records`, `link`), alle Testvektoren bestehen (`src/crypto/crypto.test.ts`).
- Entschieden: DEK als `DataKey = { dek, idk }` aus zwei `CryptoKey`s (AES extrahierbar, HMAC
  nicht). Grund: IndexedDB speichert `CryptoKey` direkt, die IDK wird nicht jedes Mal neu
  abgeleitet.
- Entschieden: Fehler beim Wiederherstellungsschlüssel als `RecoveryKeyError` mit `problem`
  (`length`, `character`, `checksum`) und deutscher Meldung; Prüfsumme: „Tippfehler im
  Schlüssel“.
- Nächster Schritt: B2 Lokale Speicherung (IndexedDB).

## 2026-11-23, 14:30 UTC · Stream 0 · sync/foundation
- Erledigt: 0.8. `sync/foundation` per `git merge --no-ff` in `sync/integration` gemergt
  (kein PR, siehe README 4), Prüfungen auf `sync/integration` grün.
- Nächster Schritt: Streams A, B und C starten von `sync/integration`.

**Stream 0 fertig**

## 2026-11-23, 14:25 UTC · Stream 0 · sync/foundation
- Erledigt: 0.5, 0.6, 0.7. protocol.md verbindlich, `server/testdata/vectors.json` mit
  Generator `gen-vectors.mjs` (zusätzlich mit Python-Stdlib gegengeprüft: Base32, Prüfzeichen,
  HKDF, HMAC-IDs, Prüfcode). Fassade `src/sync/` mit Demo-Modus, Hook `useSyncStatus`.
  Go-Gerüst `server/` (Config, Health, CORS, Protokoll-Header, Shutdown, Vektor-Loader),
  `.github/workflows/ci.yml`, `server/README.md`.
- Entschieden (Protokoll, siehe dort „Änderungen“): Wiederherstellungsschlüssel mit
  4 Prüfzeichen statt 1 (36 Zeichen = 9 Vierergruppen; 1 Zeichen passt nicht in Vierergruppen
  und erkennt weniger Tippfehler). Kopplungs-Abfrage als `GET /link/by-code/{code}`, weil
  `GET /link/{code}` und `GET /link/{linkId}` im Go-Router gleich wären. Bilddaten für
  `blobId` = UTF-8 der Data-URL (Bildtyp bleibt erhalten). Löschungen tragen auch
  Chiffretext (`row: null`), damit das Empfänger-Gerät den Schlüssel kennt.
- Entschieden: Demo-Schalter `VITE_SYNC_DEMO=true` (Build-Zeit). Ohne ihn werfen die
  Fassaden-Funktionen „not implemented“, der Status bleibt `off`. Für Stream C: mit
  `VITE_SYNC_DEMO=true npm run dev` entwickeln.
- Entschieden: `go 1.24` in `go.mod` (in der Cloud-Umgebung installiert). Stream A darf
  anheben, wenn eine Abhängigkeit es verlangt.
- Entschieden: OIDC-Variablen `OIDC_MICROSOFT_CLIENT_ID/_SECRET`, `OIDC_GOOGLE_CLIENT_ID/_SECRET`.
- Ungetestet: CI-Workflow auf GitHub (läuft erst nach dem Push).
- Nächster Schritt: 0.8 Merge nach `sync/integration`.

## 2026-11-23, 14:05 UTC · Stream 0 · sync/foundation
- Erledigt: 0.4 komplett. Migration 23 mit `_sync_state`, `_outbox` und Triggern für alle
  14 synchronisierten Tabellen, Tests in `src/db/outbox.test.ts` (alle Operationen,
  Kaskaden, `ON DELETE SET NULL`, Schlüsseländerung, Geräte-Settings, `enabled`/`applying`).
- Entschieden: Geräte-Settings = `holidayCache` (gehört zur lokalen Tabelle `Holidays`),
  `lastBackup`, `pinHash`, `colorMode`, `compactTable`, `compactTimetable` (Bildschirm).
  Liste als `DEVICE_SETTING_KEYS` in `src/lib/settings.ts`, in Migration 23 eingefroren;
  ein Test prüft, dass beide übereinstimmen.
- Entschieden: Ein UPDATE, das den Schlüssel ändert, erfasst auch den alten Schlüssel.
- Hinweis für Stream B: Eine exportierte Sicherung enthält `_sync_state` und `_outbox`.
  Beim Import muss die Sync-Engine den Zustand prüfen bzw. zurücksetzen.
- Nächster Schritt: 0.5 protocol.md verbindlich machen, Testvektoren.

## 2026-11-23, 13:50 UTC · Stream 0 · sync/foundation
- Erledigt: 0.3 komplett. Drizzle-Schema mit `text`-IDs und `$defaultFn(crypto.randomUUID)`,
  Typen `number` → `string` in Queries, Loadern, `paths`, lib, Komponenten. Test für Import
  alter Sicherungen (Version 20 → aktuell).
- Entschieden: Gleichstand gleicher Stunde in `lib/lessons.ts` jetzt per
  `id.localeCompare` statt `id - id`. Grund: stabil, Reihenfolge bei gleicher Stunde ist
  ohnehin ohne Bedeutung.
- Entschieden: `returnPage.ts` verwirft gespeicherte Rückwege mit alter Integer-Klassen-ID,
  die Seite nutzt dann ihren Rückfall. `localStorage` enthält keine IDs, nichts zu tun.
  Eine alte URL wie `#/classes/5` nach dem Update zeigt die 404-Seite (wie bisher bei
  gelöschten Klassen).
- Ungetestet: Lauf in der App mit SQLocal (keine Browser-Tests erlaubt). Insbesondere
  `ALTER TABLE … RENAME` aktualisiert Fremdschlüssel nur bei `legacy_alter_table = OFF`
  (Standard, in Node-Test geprüft). Mario sollte das Update einmal mit einer Kopie der
  echten Daten prüfen.
- Nächster Schritt: 0.4 Outbox-Tabellen und Trigger.

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


## 2026-11-23, 15:20 UTC · Stream C · sync/ui
- Erledigt: Branch `sync/ui` von `sync/integration` angelegt. C1: Tab „Konto & Sync“ mit Karte
  `SyncSettings`, Ansichten nach `lib/syncView.ts` (aus, Einrichtung, Schlüssel fehlt, aktiv,
  gesperrt) mit Vitest-Test, Erklärung und „Einrichten“ im Zustand „aus“, `useSyncAction`
  für Lade- und Fehlerzustand, README-Eintrag.
- Entschieden: „gesperrt“ = `signedOut` mit `lastSyncAt != null`; „Einrichtung“ = `signedOut`
  ohne früheren Abgleich. Grund: Die Fassade hat dafür keine eigene Phase.
- Entschieden: Ohne Engine (Stub wirft „not implemented“) zeigt die UI „Die Synchronisierung
  ist in dieser Version noch nicht verfügbar.“
- Offen: „Update nötig“ fehlt in der Fassade (blockers.md).
- Nicht geprüft: Darstellung im Browser (keine Browser-Tests).
- Erledigt: C2 Anmeldeweg (`SyncSignIn`: Gerätename, „Neues Konto mit Passkey“, „Mit Passkey
  anmelden“, Microsoft, Google). Bei „gesperrt“ nur Anmelden, kein neues Konto.
- Offen: Nach `startPasskeySignup` mit `isNewUser` zeigt die Karte noch „Schlüssel fehlt“
  (Fassade setzt `locked`). Der Ablauf Wiederherstellungsschlüssel (C2) muss das abfangen.
- Nächster Schritt: C2 Wiederherstellungsschlüssel anzeigen.

## 2026-11-23, 16:20 UTC · Stream C · sync/ui
- Erledigt: `sync/integration` (B1 Krypto) gemergt. C2 Wiederherstellungsschlüssel:
  `SyncRecoveryKey` (Knopf „Schlüssel erstellen“, Anzeige im Formular mit Benutzername
  „Notenfeder-Wiederherstellung“ und `autocomplete="new-password"`, Kopieren, Drucken, Als
  Datei speichern, Warnhinweis) und `SyncRecoveryKeyCheck` (zwei zufällige Gruppen,
  `lib/recoveryKeyCheck.ts` mit Vitest-Test). Datei und Druck in
  `services/recoveryKeyExport.ts`; `saveFile` aus `backup.ts` dafür exportiert.
- Entschieden: Nach `startPasskeySignup` mit `isNewUser` zeigt die Karte den Schlüssel-Ablauf
  statt „Schlüssel fehlt“ (lokaler Zustand in `SyncSettings`). Der Schlüssel entsteht erst
  per Knopf, damit Fehler sichtbar bleiben und ein neuer Versuch möglich ist. Die Komponente
  hat einen `intro`-Text, damit C4 („Neuen Schlüssel erstellen“) sie wiederverwenden kann.
- Entschieden: Drucken über einen versteckten iframe, damit nur der Schlüssel gedruckt wird.
- Offen: Neues Konto über Microsoft/Google (Rückkehr per Redirect) erkennt die UI nicht
  (blockers.md). Verlässt die Nutzerin die Seite vor der Kontrolle, ist der Ablauf weg.
- Nicht geprüft: Ob Safari/Chrome das Speichern im Passwortmanager anbieten (Feld ist
  `type="text"`, damit der Schlüssel lesbar bleibt) und ob Drucken in der iPad-PWA geht.
  Test auf dem iPad nötig. Keine Browser-Tests.
- Nächster Schritt: C2 „Passkey zum Entsperren hinzufügen“.
- Erledigt: C3 Anmelden (über `SyncSignIn` im Zustand „Einrichtung“) und „Schlüssel fehlt“:
  `SyncUnlock` mit „Mit Passkey entsperren“, `SyncDeviceLink` (Code anzeigen, Prüfcode
  vergleichen, „Stimmt überein“/„Abbrechen“) und Eingabe des Wiederherstellungsschlüssels
  (verstecktes Benutzername-Feld, `autocomplete="current-password"`).
- Entschieden: „Mit Passkey entsperren“ steht immer da; die Fassade sagt nicht, ob ein
  PRF-Passkey existiert (blockers.md). Ohne passenden Passkey zeigt der Knopf den Fehler.
- Offen: Lehnt Stream B `checkCode` nach `cancel()` ab, zeigt die UI kurz einen Fehler.
  Verlässt die Nutzerin die Seite während der Kopplung, läuft der Code erst serverseitig ab.
- Nicht geprüft: Ob Passwortmanager das versteckte Benutzername-Feld nutzen (iPad-Test).
- C2 „Passkey hinzufügen“ und „Erst-Upload mit Fortschritt“ sowie C3 „Download mit
  Fortschritt“ sind blockiert (Fassade fehlt, blockers.md).
- Nächster Schritt: C3 „Gerät koppeln“ auf dem alten Gerät (`confirmDeviceLink`), dann C4.
- Erledigt: C3 „Gerät koppeln“ auf dem alten Gerät (`SyncApproveLink` in der Ansicht „aktiv“:
  Code eingeben, Prüfcode vergleichen, „Stimmt überein“ sendet den Schlüssel).
- Erledigt: C4 Geräte (`SyncDevices` in „aktiv“): Liste auf Knopfdruck, letzte Aktivität,
  gesperrte Geräte durchgestrichen, „Sperren“ mit `ConfirmDialog`.
- Entschieden: Liste lädt erst auf „Geräte anzeigen“. Grund: kein Netzaufruf beim bloßen
  Öffnen der Einstellungen, kein Effect nötig.
- Offen: Umbenennen fehlt in der Fassade (blockers.md).
- Erledigt: C4 neuer Wiederherstellungsschlüssel (`SyncRecoveryKey` mit `onCancel`),
  „Abmelden“, „Synchronisierung ausschalten“, „Konto löschen“ (`SyncAccountActions`, alle mit
  `ConfirmDialog`; Löschen erst nach Eintippen von „LÖSCHEN“).
- Entschieden: „Auch Daten auf diesem Gerät löschen“ nutzt `deleteSchoolData` (Klassen,
  Schüler, Einträge, Merkmale, Dienste). Einstellungen, Ferien und Schuljahre bleiben.
  Erst wird das Konto gelöscht, dann lokal; scheitert das Konto-Löschen, bleibt alles.
- Entschieden: Hinweis der Ansicht „gesperrt“ lautet jetzt „Abgemeldet oder Anmeldung
  abgelaufen.“, weil „Abmelden“ in dieselbe Ansicht führt.
- Offen: C4 „Anmeldewege“ (Liste, Passkey/Microsoft/Google verknüpfen) fehlt in der Fassade
  (nur `AccountInfo.identities`, kein Verknüpfen; siehe blockers.md Punkt 1 für Passkey).
- Nächster Schritt: C4 Anmeldewege (Liste ist möglich, Verknüpfen blockiert), dann C5.
- Erledigt: C5 Status: `SyncBadge` in der Leiste des Speed Dials (Punkt grün/violett
  pulsierend/gelb/rot, Text im Querformat, Link auf `paths.settings("sync")`), Logik
  `getSyncBadge` in `lib/syncView.ts` mit Test. `paths.settings` nimmt jetzt einen Tab.
  Hinweis bei „gesperrt“: `SyncSignInBanner` (Snackbar unten, „Anmelden“, „Später“), nicht
  in den Einstellungen.
- Entschieden: Status neben dem Speed Dial statt im `PageHeader`, weil nur zwei Seiten den
  Header haben, der Speed Dial aber auf allen Hauptseiten ist.
- Offen: Nach bewusstem „Abmelden“ zeigt der Hinweis auch „Anmeldung abgelaufen“ (Fassade
  unterscheidet das nicht). „Später“ blendet ihn bis zum nächsten Start aus.
- Nicht geprüft: Platz der Leiste im Hochformat auf dem iPad (keine Browser-Tests).
- Nächster Schritt: C5 „Update nötig“ und Sicherungs-Import (beide blockiert), sonst C6.
- Erledigt: C4 Anmeldewege als Liste (`SyncIdentities` aus `status.account.identities`).
  Hinzufügen/Verknüpfen bleibt offen (blockers.md).
- Offen: C5 Hinweis beim Sicherungs-Import wartet auf B2 (Logik „Sync ausschalten“ beim
  Import). C5 „Update nötig“ wartet auf die Fassade (blockers.md). C6 erst danach.
- Kein Merge nach `sync/integration`: Der einzige Merge-Punkt von Stream C ist C6.
