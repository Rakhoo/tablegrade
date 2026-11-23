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

## 2026-11-23, 17:40 UTC · Stream A · sync/server
- Erledigt: A8 WebSocket. `hub.Hub` (Interface) mit `hub.Memory`, `GET /ws?token=`
  (`internal/api/ws.go`, `coder/websocket` v1.8.15), `hello`, `changed` nach jedem Push,
  `revoked` beim Sperren mit Schließen danach, Ping-Zeitlimit 90 s. Tests mit echtem
  Testserver, auch mit `-race`.
- Entschieden: Liegt eine Verbindung mehr als 16 Nachrichten zurück, schließt der Server sie
  (`1013`). Grund: `Publish` blockiert nie; der Client holt per `hello` und `pull` auf.
- Entschieden: Erst abonnieren, dann `latestSeq` lesen. Grund: Kein Push geht zwischen
  `hello` und Abo verloren.
- Protokoll ergänzt (WebSocket, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A9 Gerät koppeln.

## 2026-11-23, 17:30 UTC · Stream A · sync/server
- Erledigt: A7 Fotos. `blob.Store` mit Umsetzung `blob.FS` (`DATA_DIR/blobs/<user>/<id>`,
  Schreiben über Temp-Datei und Umbenennen), `PUT/GET /blobs/{id}` (`internal/api/blobs.go`),
  Aufräumen verwaister Blobs nach 30 Tagen in `Server.Maintain`.
- Entschieden: `blob.Store` bewegt nur Bytes; Registrierung und Verweise bleiben in
  `store.Store`. Grund: S3 später nur als zweite Umsetzung des kleinen Interfaces.
- Entschieden: Beim Aufräumen zuerst die Datei, dann die Registrierung löschen. Grund: Ein
  Fehler lässt nur einen Eintrag zurück, den der nächste Lauf erneut versucht.
- Protokoll ergänzt (Fotos, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A8 WebSocket.

## 2026-11-23, 17:21 UTC · Stream A · sync/server
- Erledigt: A6 Einträge (`internal/api/records.go`): `POST /records/push`, `GET /records/pull`,
  Last Write Wins (auch doppelte ID im selben Push), Limits, `410 gone`. Täglicher Lauf
  `Server.RunMaintenance` (`internal/api/maintenance.go`) löscht Tombstones nach 180 Tagen.
  Merge-Punkt A6 erreicht, `sync/server` in `sync/integration` gemergt.
- Entschieden: Push-Limit 60 pro Minute und Konto. Grund: Erst-Upload mit 500 Einträgen pro
  Push bleibt schnell, eine Schleife im Client fällt trotzdem auf.
- Entschieden: Die 5 MB gelten für den ganzen Body (Base64 eingerechnet). Grund: einfach zu
  prüfen; der Client teilt nach Größe des JSON.
- Entschieden: `RunMaintenance` ist der gemeinsame Ort für Aufräumarbeiten; A7 (Blobs) und
  A10 (Backup) hängen sich dort an.
- Protokoll ergänzt (Einträge, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A7 Fotos.

## 2026-11-23, 17:18 UTC · Stream A · sync/server
- Erledigt: A5 Schlüssel (`internal/api/keys.go`): `GET/PUT/DELETE /keys`, letzter
  `recovery`-Wrap nicht löschbar (Test), fremde IDs geschützt.
- Entschieden: `PUT` prüft Format streng (UUID, `A256GCM`, 60 Bytes) und dass ein
  `passkey`-Wrap zu einem Passkey des Kontos gehört. `org` lehnt der Server vorerst ab.
- Entschieden: Zwei `recovery`-Wraps sind kurz erlaubt. Grund: Der Wechsel geht laut Protokoll
  per `PUT` neu, dann `DELETE` alt.
- Protokoll ergänzt (Schlüssel, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A6 Einträge.

## 2026-11-23, 17:15 UTC · Stream A · sync/server
- Erledigt: A4 Microsoft und Google. Paket `internal/oidc` (Codetausch per `net/http`,
  ID-Token mit `go-oidc` geprüft, Issuer fest), Test-Anbieter `internal/oidc/oidctest`
  (`httptest`, eigenes JWKS, Signatur mit `go-jose`). Endpunkte in `internal/api/oidc.go`.
- Entschieden: `go-oidc` v3.17.0, weil neuere Versionen Go 1.25 verlangen.
- Entschieden: Keine Discovery, sondern feste Endpunkte und JWKS-URL. Grund: Microsoft
  `consumers` meldet in der Discovery einen Issuer mit Platzhalter; der echte Issuer ist der
  feste Mandant `9188040d-…`. Der Server braucht so beim Start kein Netz.
- Entschieden: `subject` = Claim `sub`. Der Mandant ist durch den Issuer festgelegt.
- Entschieden: `email_verified: false` wird abgelehnt; fehlt der Claim (Scope nur `openid`),
  ist das in Ordnung.
- Entschieden: Microsoft braucht jetzt auch ein Client-Secret (wie in manual-steps.md,
  Plattform „Web“). Grund: Der Server tauscht den Code als vertraulicher Client.
- Protokoll ergänzt (OIDC, Abschnitt „Änderungen“). Betrifft Stream B und C.
- Ungetestet: echte Anmeldung bei Microsoft und Google (erst mit Marios OAuth-Apps).
- Nächster Schritt: A5 Schlüssel.
## 2026-11-23, 17:20 UTC · Stream B · sync/client
- Erledigt: B7 (Signaturen und Demo). `SyncPhase` mit `upgradeRequired`,
  `AccountInfo.hasDataKey`/`hasPrfPasskey`, `SyncStatus.progress`, Fassade mit `addPasskey`,
  `linkOidcIdentity`, `renameDevice`, `hasLocalData`, `replaceLocalData`; alle in `demo.ts`.
  `checkSession` holt zusätzlich `GET /keys` und setzt daraus `hasDataKey` und
  `hasPrfPasskey` (`accountInfo` in `session.ts`); HTTP 426 → `upgradeRequired`.
- Entschieden: `hasPrfPasskey` = es gibt einen `passkey`-Wrap. Grund: Wraps entstehen nur für
  Passkeys mit PRF; `GET /auth/session` liefert keine Passkey-Liste.
- Entschieden: Ohne Demo-Modus werfen die neuen Fassaden-Funktionen wie die alten noch
  „not implemented“. Die echte Verdrahtung kommt gesammelt in B6 („Stubs entfernt“).
- Nächster Schritt: B5 Sync-Engine (braucht Migration 24 für `_sync_pending`).

## 2026-11-23, 17:45 UTC · Stream B · sync/client
- Erledigt: B4 (Logik). `webauthn.ts` (JSON-Optionen von Hand umgewandelt, PRF-Erweiterung,
  deutsche Fehlermeldungen), `passkeyFlow.ts` (Registrierung, Login, weiterer Passkey,
  Entsperren per Passkey), `oidc.ts` (PKCE `S256`, `state`, Rückkehr, URL ohne Query mit
  Hash-Route), `keyring.ts` (nach Login entsperren, neues Konto mit neuer DEK,
  Wiederherstellungsschlüssel ersetzen, Passkey-Wrap, Abmelden). Tests in `auth.test.ts`
  (Keyring über drei Geräte, Tippfehler, falsches Konto, OIDC-Ablauf).
- Entschieden: OIDC-Zwischenstand in `localStorage` (`notenfeder-oidc`), nicht
  `sessionStorage`. Grund: In der installierten PWA auf dem iPad geht `sessionStorage` beim
  Wechsel zum Anbieter verloren, wenn iOS den Web-View neu erzeugt.
- Entschieden: Liefert ein Passkey bei der Registrierung nur `prf.enabled`, holt ein zweiter
  Dialog die PRF-Ausgabe. Die PRF-Ausgabe geht nie an den Server.
- Entschieden: Der Wiederherstellungsschlüssel wird beim Ersetzen erst hochgeladen, dann
  werden alte gelöscht (nie ohne `recovery`-Wrap).
- Offen: Aufruf von `finishOidcLogin` beim App-Start (`?oidc=callback`) kommt mit der
  Fassade (B6); die Logik ist fertig. Passkey/PRF und OIDC-Rückkehr in der PWA sind nur auf
  dem iPad prüfbar (keine Browser-Tests).
- Nächster Schritt: B5 Sync-Engine (braucht Migration 24 für `_sync_pending`).

## 2026-11-23, 17:05 UTC · Stream B · sync/client
- Erledigt: B3. `src/sync/api.ts` (alle Endpunkte, `ApiError` mit Code, Status, deutscher
  Meldung, `retryAfter`; Netzfehler = `offline`), `src/sync/session.ts` (`checkSession`,
  `sessionStatus`, `startSessionMonitor`: Start, 15 min, `online`, sichtbar), Tests in
  `src/sync/api.test.ts`. `VITE_SYNC_URL` in `src/sync/config.ts`.
- Entschieden: Gesperrte oder abgelaufene Sitzung → Phase `signedOut`, Grund in `error`
  (kein neuer Phasen-Wert `revoked`, damit die Fassade gleich bleibt). Offline behält das Konto.
- Entschieden: `import.meta.env` nur in `config.ts`, weil die Node-Tests es nicht kennen.
- Nächster Schritt: B4 Anmeldung (Passkey, OIDC, Entsperren).

## 2026-11-23, 16:40 UTC · Stream B · sync/client
- Erledigt: B2. `src/sync/deviceStore.ts` (IndexedDB `notenfeder-sync`, Speicher im Speicher für
  Tests), `syncState.ts` (`_sync_state`), `importGuard.ts` mit Tests, `SyncDb`-Interface
  (`src/sync/syncDb.ts`) mit Adapter `src/db/queries/syncDb.ts` (SQLocal) und
  `src/test/syncTestDb.ts` (`node:sqlite`).
- Entschieden: DEK, Sitzung (`token`, `userId`, `deviceId`) und `syncId` in IndexedDB;
  `lastSeq` in `_sync_state`. Grund: `lastSeq` muss in derselben Transaktion wie die gezogenen
  Zeilen committen; es ist kein Geheimnis. `_sync_state` hat nur die Schlüssel `enabled`,
  `applying`, `lastSeq`, `syncId` (Typ `SyncStateKey`).
- Entschieden: Import-Erkennung über `syncId` (Zufalls-ID pro Einschalten, in DB und
  IndexedDB). Weichen sie ab: Sync aus, `lastSeq`/`syncId` weg, `_outbox` leeren, Sitzung lokal
  entfernen, DEK bleibt. War Sync hier aktiv: `importNotice` im Gerätespeicher für den Hinweis.
- Für B5: Einschalten muss `syncId` in beiden Speichern setzen; Engine-Start ruft
  `checkImportedDatabase` auf.
- Für Stream C (Vorschlag, Fassaden-Erweiterung): `takeImportNotice(): Promise<boolean>`
  liefert einmalig `true` nach einem Import über aktiven Sync. Kommt mit B5/B6.
- Nächster Schritt: B3 API-Client.

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

