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

## 2026-11-23, 17:45 UTC · Stream A · sync/server
- Erledigt: Blocker „Server-Sicherung zurückgespielt“ mit Mario geklärt (Option B, Gerät
  gewinnt). Server antwortet bei `after` > `latestSeq` mit `410 server_restored` statt `gone`.
  Protokoll und Test angepasst.
- Nächster Schritt: Stream B setzt den Client-Teil um (neue Aufgabe in tasks-b-client.md).

## 2026-11-23, 17:50 UTC · Stream A · sync/server
- Erledigt: A12 Abschluss. Alle Endpunkte aus protocol.md sind vorhanden und haben Go-Tests
  (Test-Datei in Klammern, alle in `server/internal/api/`):
  - `GET /health` (`api_test.go`)
  - `POST /auth/passkey/register/begin|finish`, `POST /auth/passkey/login/begin|finish`
    (`passkey_test.go`)
  - `GET /auth/oidc/{provider}/config`, `POST /auth/oidc/{provider}/exchange` (`oidc_test.go`)
  - `GET /auth/session`, `POST /auth/logout`, `POST /auth/dev/login` (`api_test.go`)
  - `GET /devices`, `PATCH /devices/{id}`, `POST /devices/{id}/revoke` (`api_test.go`,
    `ws_test.go`)
  - `GET /keys`, `PUT /keys/{id}`, `DELETE /keys/{id}` (`keys_test.go`)
  - `POST /records/push`, `GET /records/pull` (`records_test.go`)
  - `PUT /blobs/{id}`, `GET /blobs/{id}` (`blobs_test.go`)
  - `GET /ws` (`ws_test.go`)
  - `POST /link`, `GET /link/by-code/{code}`, `POST /link/{linkId}/complete`,
    `GET /link/{linkId}` (`links_test.go`)
  - `DELETE /account` (`account_test.go`)
- Aufgeräumt: ungenutzte Funktion `auth.Sessions.End` entfernt.
- Testabdeckung: `internal/api` 81 %, `store/sqlite` 88 %, `oidc` 88 %, `hub` 94 %.
- Offen für Mario: blockers.md (Verhalten nach Zurückspielen einer Sicherung); echte Logins
  (Microsoft, Google, Passkeys auf iPad/PC), Image-Build und Pi-Betrieb (siehe manual-steps.md).
- Merge-Punkt A12 erreicht, `sync/server` in `sync/integration` gemergt.

**Stream A fertig**

## 2026-11-23, 17:45 UTC · Stream A · sync/server
- Erledigt: A11 Docker und Pi. `server/Dockerfile` (Cross-Compile, distroless static,
  UID 65532, Healthcheck über `notenfeder-server healthcheck`), `server/deploy/compose.yaml`
  (`server` nur auf 127.0.0.1, `backup` mit `rclone/rclone:1.75`), `.env.example`,
  systemd-Timer `notenfeder-update.*`, Workflow `.github/workflows/server-image.yml`,
  Pi-Anleitung in `server/README.md` (Einrichten, Update, Sicherung zurückspielen).
- Entschieden: Kein Watchtower. `containrrr/watchtower` ist seit 17.12.2025 archiviert und
  passt nicht zu Docker 29. Statt eines Forks ein systemd-Timer mit
  `docker compose pull && up -d` alle 30 Minuten. Grund: kein fremdes Image mit Zugriff auf
  den Docker-Socket, keine neue Abhängigkeit. manual-steps.md und Plan-Tabelle angepasst.
- Entschieden: Daten als Bind-Mount `./data` statt Named Volume. Grund: Sicherung zurückspielen
  und rclone-Zugriff sind so einfacher.
- Entschieden: `GET /records/pull` gibt `410 gone` auch bei `after` > `latestSeq` (nach
  Zurückspielen einer Sicherung). Folgefrage in blockers.md (betrifft Stream B).
- Ungetestet: Image-Build und Compose (kein Docker-Daemon in der Cloud), Workflow (läuft erst
  auf `main`). Healthcheck lokal mit dem Binary geprüft.
- Nächster Schritt: A12 Abschluss.

## 2026-11-23, 17:35 UTC · Stream A · sync/server
- Erledigt: A10 Konto und Betrieb. `DELETE /account` (`internal/api/account.go`, löscht DB-Daten
  und Blob-Ordner, `revoked` an alle Geräte), tägliche Sicherung (`internal/api/backup.go`,
  `VACUUM INTO`, 7 Dateien), JSON-Logs und Access-Log ohne Query, IP und IDs
  (`internal/api/accesslog.go`). Merge-Punkt A10 erreicht, `sync/server` in `sync/integration`
  gemergt.
- Entschieden: Access-Log nutzt das Route-Muster (`GET /api/v1/blobs/{id}`) statt des Pfads.
  Grund: Der WebSocket-Token steht in der Query, IDs stehen im Pfad.
- Entschieden: Sicherung läuft in `Server.Maintain` (Start und alle 24 h); ein Neustart am
  selben Tag schreibt keine zweite Datei.
- Entschieden: Schlägt das Löschen der Blob-Dateien nach `DELETE /account` fehl, wird das nur
  geloggt. Grund: Das Konto ist schon weg, ein erneuter Versuch des Clients ginge nicht.
- Nächster Schritt: A11 Docker und Pi.

## 2026-11-23, 17:27 UTC · Stream A · sync/server
- Erledigt: A9 Gerät koppeln (`internal/api/links.go`): `POST /link`, `GET /link/by-code/{code}`,
  `POST /link/{linkId}/complete`, `GET /link/{linkId}`, 10 Minuten gültig, nur im selben Konto,
  5 Fehlversuche, WebSocket-Nachricht `link`, Aufräumen abgelaufener Kopplungen in
  `Server.Maintain`. Merge-Punkt A9 erreicht, `sync/server` in `sync/integration` gemergt.
- Entschieden: `link` geht an alle Geräte des Kontos. Grund: Der Server speichert nicht,
  welches Gerät die Kopplung begonnen hat; die `linkId` reicht dem neuen Gerät.
- Entschieden: `GET /link/by-code` zählt zum IP-Rate-Limit der `auth`-Endpunkte (jede
  Anfrage, nicht nur Fehlversuche). Grund: einfach und streng genug.
- Protokoll ergänzt (Kopplung, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A10 Konto und Betrieb.

## 2026-11-23, 17:25 UTC · Stream A · sync/server
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

## 2026-11-23, 17:23 UTC · Stream A · sync/server
- Erledigt: A7 Fotos. `blob.Store` mit Umsetzung `blob.FS` (`DATA_DIR/blobs/<user>/<id>`,
  Schreiben über Temp-Datei und Umbenennen), `PUT/GET /blobs/{id}` (`internal/api/blobs.go`),
  Aufräumen verwaister Blobs nach 30 Tagen in `Server.Maintain`.
- Entschieden: `blob.Store` bewegt nur Bytes; Registrierung und Verweise bleiben in
  `store.Store`. Grund: S3 später nur als zweite Umsetzung des kleinen Interfaces.
- Entschieden: Beim Aufräumen zuerst die Datei, dann die Registrierung löschen. Grund: Ein
  Fehler lässt nur einen Eintrag zurück, den der nächste Lauf erneut versucht.
- Protokoll ergänzt (Fotos, Abschnitt „Änderungen“). Betrifft Stream B.
- Nächster Schritt: A8 WebSocket.
## 2026-11-23, 17:45 UTC · Stream B · sync/client (Lauf 17:12)
- Erledigt: B5 Sync-Engine. Migration 24 (`_sync_pending`, `_sync_blobs`),
  `SCHEMA_VERSION` in `db/migrations.ts`. Module `tables.ts` (aktuelle Tabellenliste),
  `push.ts`, `pull.ts`, `photos.ts`, `activation.ts` (`turnOn`/`turnOff`), `engine.ts`
  (`runSync`, `createSyncEngine`), `socket.ts`. Tests mit zwei Geräten und Fake-Server
  (`src/test/fakeSyncServer.ts`, `src/test/syncDevices.ts`): `pushPull.test.ts`,
  `engine.test.ts`.
- Entschieden: Pull holt alle Seiten und wendet sie in **einer** Transaktion an. Grund: Ein
  Kind-Eintrag auf Seite 1 darf seinen Eltern-Eintrag von Seite 2 nicht verpassen.
- Entschieden: Eingehende Einträge für Schlüssel mit Eintrag in `_outbox` werden übersprungen.
  Grund: Die lokale Änderung wird danach gepusht und gewinnt per höherer `seq`.
- Entschieden: Zwei Noten für dieselbe Stunde (`GradesUnique`): Die Zeile mit dem größeren
  Schlüssel gewinnt auf allen Geräten, die andere wird gelöscht und die Löschung gepusht.
- Entschieden: Waisen (z. B. Note zu hier gelöschtem Schüler) löscht der Pull per
  `PRAGMA foreign_key_check`, sonst scheitert die ganze Transaktion.
- Entschieden: Nach `410` werden lokale Zeilen, die der Server nicht mehr kennt, erneut
  hochgeladen (kein Datenverlust).
- Entschieden: Der Import-Guard nutzt jetzt `turnOff` (leert auch `_sync_pending`, `_sync_blobs`).
- Offen für B6: Engine an Fassade, Device-Store und Status anbinden; `onApplied` →
  Revalidierung (Hook); lokale Änderungen müssen `requestSync` auslösen (z. B. entprellt
  nach Schreibzugriffen oder Intervall). README-Abschnitt kommt mit Stream D.
- Nächster Schritt: B6 Kopplung und Konto, Fassade verdrahten.

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

### 2026-11-23 · Stream C
- Erledigt: C7 „Update nötig“ (Ansicht `upgrade` in `lib/syncView.ts`, Karte mit „Neu laden“,
  Hinweis auf allen Seiten; `SyncSignInBanner` heißt jetzt `SyncNoticeBanner`).
- Erledigt: C7 neues Konto ohne Schlüssel (Ansicht `createKey` bei `hasDataKey == false`,
  auch nach Microsoft/Google). `SyncSignIn.onSignedIn` entfällt, die Ansicht folgt dem Status.
- Erledigt: C7/C2 Passkey: „Mit Passkey entsperren“ nur bei `hasPrfPasskey`, sonst Angebot
  „Passkey hinzufügen“ in der aktiven Ansicht (`SyncAddPasskey`, ruft `addPasskey()`).
- Entschieden: B7 ist noch nicht in `sync/integration`. Die Signaturen aus B7
  (`upgradeRequired`, `hasDataKey`, `hasPrfPasskey`, `addPasskey`) sind in `types.ts`,
  `index.ts` und `demo.ts` vorgebaut. Beim nächsten Merge von `sync/integration` die Fassung
  von Stream B übernehmen.
- Erledigt: C7 Geräte umbenennen (Stift-Knopf, `ConfirmDialog` mit Namensfeld) und
  Anmeldewege („Passkey hinzufügen“ bei vorhandenem Entsperr-Passkey, sonst im Angebot;
  „Microsoft/Google verknüpfen“ nur für noch nicht verknüpfte). `renameDevice` und
  `linkOidcIdentity` ebenfalls in Fassade und Demo vorgebaut.
- Nicht geprüft: Ansichten im Browser (keine Browser-Tests).
- Erledigt: C7 Fortschritt (Balken „Erster Abgleich: x von y Einträgen“ in der aktiven
  Ansicht aus `SyncStatus.progress`) und Frage vor dem Erst-Download (`SyncReplaceCheck`:
  „Daten ersetzen“ mit `ConfirmDialog` oder „Abbrechen“ = Sync aus). C7 damit fertig,
  Stream-C-Einträge in blockers.md auf „erledigt“.
- Entschieden: Ist `hasLocalData()` fehlgeschlagen, fragt die UI trotzdem (sicherer).
- Offen: C5 Hinweis beim Sicherungs-Import wartet auf B2.
- Nächster Schritt: C6 (README, Merge-Punkt), sobald B7 in `sync/integration` ist und die
  vorgebauten Signaturen damit abgeglichen sind.

## 2026-11-23, 18:40 UTC · Stream C · sync/ui
- Erledigt: `sync/integration` gemergt (B2, B5, B7). Konflikte in `src/sync/types.ts`,
  `index.ts`, `demo.ts`: Fassung von Stream B übernommen. Die UI kompiliert damit ohne Änderung.
- Erledigt: C6 README (Datenschutz mit optionalem Sync, Feature „Konto & Sync“, Hilfe-Texte,
  Projektstruktur `src/sync/`, `settings/Sync*`, `server/`). CLAUDE.md bleibt Stream D.
- Blockiert: C5 Hinweis beim Sicherungs-Import. B2 speichert `importNotice` nur im
  Gerätespeicher, die Fassade gibt ihn nicht heraus (blockers.md, Vorschlag für Stream B).
- Entschieden: Stream C nach `sync/integration` gemergt, obwohl C5 noch offen ist. Grund: alle
  übrigen Aufgaben fertig, Prüfungen grün. „Stream C fertig“ erst nach C5.
- Geprüft: tsc, lint, build, vitest (106 Tests), `go vet`, `go test`. Nicht geprüft: Browser.
