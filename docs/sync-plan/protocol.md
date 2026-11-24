# Protokoll

Streams A–D ändern das Protokoll nur gemeinsam: Änderung hier eintragen, im Abschnitt
„Änderungen“ vermerken, in progress.md ankündigen. Die Testvektoren in
`server/testdata/vectors.json` (erzeugt von `server/testdata/gen-vectors.mjs`) sind Teil des
Protokolls. Go- und Vitest-Tests prüfen gegen sie.

Status: **verbindlich** (seit 2026-11-23, Stream 0)

## 1. Grundregeln

- Alle Pfade unter `/api/v1`. JSON mit `camelCase`. Binärdaten als Base64url ohne Padding.
- Zeiten als Unix-Millisekunden, immer vom Server gesetzt.
- Auth per Header `Authorization: Bearer <sessionToken>`. WebSocket per Query `?token=` beim
  Aufbau (Browser können beim WebSocket keine Header setzen), danach nie wieder.
- CORS: erlaubt sind nur die konfigurierten App-Origins (`APP_ORIGINS`, kommagetrennt:
  Produktion `https://tablegrade.pages.dev` und Dev-Vorschau `https://dev.tablegrade.pages.dev`).
  `RP_ID` für Passkeys ist `tablegrade.pages.dev`; die Dev-Vorschau darf diese RP-ID als
  übergeordnete Domain nutzen, Passkeys gelten also für beide. Die App läuft mit
  COEP `require-corp`. Fotos lädt sie darum per `fetch`, nicht per `<img src>`.
- Fehler: HTTP-Status plus `{ "error": "<code>", "message": "<deutsch, für die UI>" }`.
  Codes: `unauthorized`, `session_revoked`, `not_found`, `conflict`, `too_large`,
  `rate_limited`, `upgrade_required`, `bad_request`.
- Weitere Codes: `gone` (410, siehe 4), `server_restored` (410, siehe 4), `forbidden` (403),
  `not_approved` (403, Konto noch nicht freigeschaltet, siehe 2), `internal` (500, Serverfehler).
- Status je Code: `bad_request` 400, `unauthorized` 401, `session_revoked` 401, `forbidden` 403,
  `not_found` 404, `conflict` 409, `gone` 410, `server_restored` 410, `too_large` 413, `upgrade_required` 426,
  `rate_limited` 429 (mit Header `Retry-After` in Sekunden).
- Jede Antwort trägt `X-Protocol-Version: 1`. Der Client sendet denselben Header. Sendet der
  Client eine höhere Hauptversion als der Server kennt: `upgrade_required`.
- Texte (Labels, AAD, HMAC-Eingaben) sind immer UTF-8. `‖` heißt Bytes aneinanderhängen.
- HKDF ist immer HKDF-SHA256 mit 32 Bytes Ausgabe. `salt=""` heißt leeres Salt (WebCrypto:
  `new Uint8Array(0)`, nach RFC 5869 gleichwertig zu 32 Null-Bytes).
- AES-256-GCM immer mit 12 Bytes Nonce und 16 Bytes Tag. Format überall
  `nonce(12) ‖ ciphertext ‖ tag(16)` (WebCrypto liefert `ciphertext ‖ tag` am Stück).
- Crockford-Base32: Alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, Bits von vorne (MSB zuerst),
  ohne Padding. Eingabe-Normalisierung: Leerzeichen und `-` entfernen, Großbuchstaben,
  `O`→`0`, `I` und `L`→`1`. `U` und andere Zeichen sind ungültig.

## 2. Konten, Identitäten, Sitzungen

Datenmodell auf dem Server (erweiterbar für Org-Kunden laut Konzept):

```
users       id (uuid), createdAt, customerId? (später), deletedAt?
identities  userId, provider ('passkey' | 'microsoft' | 'google'), subject, createdAt
passkeys    userId, credentialId, publicKey, signCount, transports, prfCapable, name, createdAt
devices     id (uuid), userId, name, createdAt, lastSeenAt, revokedAt?
sessions    tokenHash, userId, deviceId, createdAt, lastUsedAt, expiresAt
keyWraps    id, userId, kind ('passkey' | 'recovery' | 'org'), credentialId?, alg, wrapped, createdAt
```

- Ein Sitzungs-Token ist 32 Zufallsbytes. Der Server speichert nur SHA-256 davon.
- Eine Sitzung gehört zu genau einem Gerät. Sie läuft nach 90 Tagen ohne Nutzung ab. Jede
  Nutzung verlängert sie.
- `devices.revokedAt` gesetzt → alle Sitzungen des Geräts liefern `session_revoked`.

### Endpunkte

| Methode, Pfad | Zweck |
|---|---|
| `POST /auth/passkey/register/begin` | Optionen für ein neues Konto oder einen weiteren Passkey (mit Sitzung). Fordert die PRF-Erweiterung an. |
| `POST /auth/passkey/register/finish` | Passkey speichern. Ohne Sitzung: neues Konto plus Sitzung. |
| `POST /auth/passkey/login/begin` | Optionen für den Login (discoverable credentials). |
| `POST /auth/passkey/login/finish` | Prüfen, Sitzung anlegen. |
| `GET  /auth/oidc/{provider}/config` | Client-ID, Authorize-URL, Scopes für den Browser. |
| `POST /auth/oidc/{provider}/exchange` | Body: `code`, `codeVerifier`, `redirectUri`, `deviceName`. Server tauscht ein, prüft das ID-Token, legt bei Bedarf ein Konto an (oder verknüpft mit Sitzung), gibt Sitzung zurück. |
| `GET  /auth/session` | Prüfung der Sitzung: `{ userId, deviceId, identities[], devices[], approved, contactEmail, accessNote }`. |
| `POST /auth/logout` | Sitzung beenden. |
| `GET  /devices` / `POST /devices/{id}/revoke` / `PATCH /devices/{id}` | Geräte auflisten, sperren, umbenennen. |
| `PUT  /account/contact` | Body `{ email, note }`: Kontakt-Adresse und Begründung der Zugangsanfrage. Leere Werte löschen. Antwort `204`. |
| `DELETE /account` | Konto mit allen Daten löschen (nach Bestätigung in der UI). Antwort `204`; verbundene Geräte bekommen per WebSocket `revoked`, ihre Sitzungen gelten danach als ungültig (`unauthorized`). |
| `POST /auth/dev/login` | Nur mit `DEV_AUTH=1` (Tests). Body `{ deviceName, userId? }`. Ohne `userId` neues Konto, mit `userId` weiteres Gerät dieses Kontos. Antwort wie jede Anmeldung. |

Antwort bei erfolgreicher Anmeldung:
`{ "sessionToken", "userId", "deviceId", "isNewUser" }`. `sessionToken` ist Base64url.

- `register/begin` und `login/begin` liefern `{ challengeId, options }`. `options` sind die
  WebAuthn-Optionen im JSON-Format (`PublicKeyCredentialCreationOptionsJSON` bzw.
  `…RequestOptionsJSON`, Binärfelder Base64url). `finish` bekommt
  `{ challengeId, credential, deviceName }`, `credential` per `toJSON()`. Eine Challenge
  gilt 5 Minuten und nur einmal.
- `register/finish` speichert `prfCapable = true`, wenn der Client
  `clientExtensionResults.prf.enabled = true` meldet (oder dort schon `prf.results` liefert).
- `begin` bekommt den Body `{}`. Mit `Authorization`-Header gilt `register/*` für einen
  weiteren Passkey des Kontos; ein ungültiges Token gibt `unauthorized` (nie ein neues Konto).
  `register/finish` mit Sitzung antwortet `204`, `deviceName` ist dann nur die Bezeichnung des
  Passkeys. Mehr als 20 Passkeys: `conflict`.
- Die WebAuthn-User-ID (`user.id`) ist die UTF-8-Kodierung der `userId`.
- Die Optionen beider `begin` enthalten schon `extensions.prf.eval.first` = Base64url des
  PRF-Salts (siehe 3). Optionen verlangen `residentKey: required`.
- Jede fehlgeschlagene Passkey-Prüfung gibt `401 unauthorized`; eine abgelaufene oder schon
  benutzte Challenge gibt `400 bad_request`.
- Gerät: Jede neue Sitzung ohne bestehende Sitzung legt ein neues Gerät mit `deviceName` an.
- `GET /auth/oidc/{provider}/config` liefert
  `{ clientId, authorizeUrl, scopes: ["openid", "email"], redirectUri }`. Der Browser nutzt PKCE
  (`S256`) und `state`; beides prüft nur der Browser.
- `{provider}` ist `microsoft` oder `google`. Ein Anbieter ohne Client-ID ist aus: `404 not_found`.
  `redirectUri` gehört zur App-Origin aus dem `Origin`-Header (sonst die erste aus
  `APP_ORIGINS`). `exchange` nimmt nur diese Redirect-URIs an, sonst `bad_request`.
- Ein Konto hat genau einen Anmeldeweg (Microsoft oder Google). `exchange` mit Sitzung
  antwortet darum `409 conflict`; zum Wechseln abmelden. Ohne Sitzung: Login
  oder neues Konto, Antwort wie jede Anmeldung, dazu `email` (Claim `email`, fehlt ohne
  Claim). Das Gerät zeigt sie als „Angemeldet als …“ und speichert sie nur lokal. Abgelehnter Code oder ungültiges ID-Token:
  `401 unauthorized`.
- Identität: `subject` ist bei OIDC der Claim `sub` (Google) bzw. `sub` mit Mandant
  `consumers` (Microsoft), bei Passkeys die `credentialId` (Base64url). E-Mail oder Name
  speichert und protokolliert der Server nicht.
- **Freischaltung:** Ein neues Konto hat `approved: false`. Anmelden, `GET /auth/session`,
  Logout, Geräte, `PUT /account/contact` und `DELETE /account` gehen. Schlüssel, Einträge,
  Fotos, Kopplung und WebSocket antworten mit `403 not_approved`. Mario schaltet Konten per
  Befehl auf dem Server frei (`notenfeder-server admin approve`, siehe `server/README.md`).
  Konten von vor dieser Änderung gelten als freigeschaltet. Test-Logins (`DEV_AUTH`) auch.
- **Kontakt:** `email` ist eine reine Adresse (ohne Anzeigenamen, höchstens 254 Zeichen),
  `note` höchstens 500 Zeichen. Zweck: Freischaltung, Wartung, Bezahlung. Beides liegt im
  Klartext auf dem Server (Ausnahme vom Grundsatz „nur Chiffretext“, mit diesem Zweck) und wird
  mit dem Konto gelöscht. In `GET /auth/session` ist ein leerer Wert `null`.
- Die App meldet sich nur mit Microsoft oder Google an. Passkeys legt sie nur mit Sitzung an,
  zum Entsperren. Anmelden per Passkey und neues Konto per Passkey bietet der Server weiter
  an, die App nutzt es nicht.
- `GET /auth/session`: `identities` = `[{ provider, createdAt }]` (ohne `subject`), `devices` wie bei
  `GET /devices`. `POST /auth/logout`, `PATCH /devices/{id}` und `POST /devices/{id}/revoke`
  antworten mit `204` ohne Body. Gerätenamen: 1–80 Zeichen, Leerzeichen am Rand werden entfernt.
- `GET /devices` liefert `{ devices: [{ id, name, createdAt, lastSeenAt, revokedAt, current }] }`.
  `PATCH /devices/{id}` mit `{ name }`. Ein Gerät kann sich selbst nicht sperren (`conflict`),
  dafür gibt es `logout`.

Microsoft: Mandant `consumers` (nur private Konten). Google: normale OAuth-Client-ID vom Typ
„Webanwendung“. Redirect-URI ist die App-Origin mit Pfad `/`, ohne Query (Microsoft lehnt
Redirect-URIs mit Query ab). Die App erkennt die Rückkehr an `state` plus `code` oder `error`.

## 3. Schlüssel

| Name | Inhalt |
|---|---|
| DEK | Datenschlüssel, AES-256-GCM, 32 Zufallsbytes, einer pro Konto. |
| IDK | ID-Schlüssel, `HKDF-SHA256(DEK, salt="", info="notenfeder/record-id/v1")`, HMAC-SHA256. |
| Wrap | AES-256-GCM-Verschlüsselung der 32 DEK-Bytes mit einem KEK, AAD = `notenfeder/wrap/v1/<kind>/<userId>`. Format: `nonce(12) ‖ ciphertext+tag`. |

KEK je Art:

- **passkey:** PRF-Ausgabe (32 Bytes) für das feste Salt `SHA-256("notenfeder/prf/v1")`,
  dann `HKDF-SHA256(prf, salt="", info="notenfeder/kek/passkey/v1")`. Ein Wrap pro Passkey
  (`credentialId`). Passkeys ohne PRF dienen nur zum Login.
- **recovery:** 20 Zufallsbytes (160 Bit). KEK = `HKDF-SHA256(bytes, salt="",
  info="notenfeder/kek/recovery/v1")`. Kein langsames KDF nötig, die Entropie ist hoch genug.
  Text: 32 Zeichen Crockford-Base32 der Bytes, dann 4 Prüfzeichen = die ersten 20 Bit von
  `SHA-256("notenfeder/recovery/v1" ‖ bytes)` als Crockford-Base32. Zusammen 36 Zeichen,
  angezeigt in 9 Vierergruppen mit `-`, z. B. `K7QF-M2XA-…`. Eingabe: normalisieren (siehe 1),
  Länge 36 prüfen, Prüfzeichen prüfen. Falsche Prüfzeichen → Meldung „Tippfehler im
  Schlüssel“, ohne Serveranfrage.
- **org:** später (Master-Key der Schule, öffentlicher Schlüssel). Das Format `alg` lässt Platz.

- Ein Wrap als JSON: `{ id, kind, credentialId?, alg, wrapped, createdAt }`. `id` ist eine
  UUID vom Client. `alg` ist `"A256GCM"` für passkey und recovery. `wrapped` ist Base64url.
- Pro Konto gibt es höchstens einen `recovery`-Wrap. Ein neuer Wiederherstellungsschlüssel
  ersetzt den alten (`PUT` mit neuer `id`, dann `DELETE` der alten).

| Methode, Pfad | Zweck |
|---|---|
| `GET /keys` | Alle Wraps des Kontos: `{ keys: [ … ] }`. |
| `PUT /keys/{id}` | Wrap anlegen oder ersetzen (z. B. neuer Passkey, neuer Wiederherstellungsschlüssel). |
| `DELETE /keys/{id}` | Wrap löschen. Der letzte `recovery`-Wrap lässt sich nicht löschen. |

- `PUT` und `DELETE` antworten `204`. `{id}` ist eine kleingeschriebene UUID; eine `id` im Body
  muss gleich sein (sie darf fehlen). `createdAt` setzt der Server.
- `PUT` prüft: `kind` ist `passkey` oder `recovery` (`org` folgt später), `alg` ist `A256GCM`,
  `wrapped` hat genau 60 Bytes. `passkey` braucht eine `credentialId` eines Passkeys dieses
  Kontos, `recovery` keine. Sonst `bad_request`. Gehört die `id` einem anderen Konto: `conflict`.
- `DELETE` des letzten `recovery`-Wraps: `conflict`. Unbekannte `id`: `not_found`.

## 4. Einträge

```
records  userId, id, seq, updatedAt, deleted, schema, ciphertext, deviceId
```

- `id` = Base64url von `HMAC-SHA256(IDK, "<tabelle>|<primärschlüssel>")`, gekürzt auf 16 Bytes
  (22 Zeichen). Der Primärschlüssel ist die UUID bzw. bei zusammengesetzten Schlüsseln die
  Werte in Schema-Reihenfolge, getrennt mit `|`. Zahlen (`SchoolYears.year`) als Dezimalzahl
  ohne führende Nullen. UUIDs klein geschrieben. `<tabelle>` ist der SQL-Name (z. B.
  `Classes`). So verrät die ID weder Tabelle noch Datum.
- `seq` vergibt der Server, streng steigend pro Konto.
- Klartext vor der Verschlüsselung:
  `{ "t": "<tabelle>", "k": [<primärschlüssel>], "v": <schema-version>, "row": { … } | null }`.
  `row: null` bei Löschung.
- `row` enthält alle Spalten mit ihren SQL-Namen und Werten wie in SQLite (Text, Zahl,
  `null`). Der Klartext ist UTF-8-JSON; die Reihenfolge der Felder ist egal.
- Verschlüsselung: AES-256-GCM mit DEK, Nonce 12 Zufallsbytes, AAD = `notenfeder/record/v1/<userId>/<id>`.
  `ciphertext` = `nonce ‖ ciphertext+tag`, im JSON als Base64url.
- `schema` = Version der lokalen DB (wie `BASELINE_VERSION + Migrationen`), unverschlüsselt,
  damit ein altes Gerät neue Einträge erkennt und zurückstellt.

| Methode, Pfad | Zweck |
|---|---|
| `POST /records/push` | Body: `{ records: [{ id, deleted, schema, ciphertext, blobs }] }`, max. 500 Einträge bzw. 5 MB. Antwort: `{ results: [{ id, seq, updatedAt }] }` in derselben Reihenfolge. Last Write Wins: der neue Eintrag ersetzt immer den alten. Eine ID doppelt im selben Push: der letzte gewinnt. |
| `GET /records/pull?after=<seq>&limit=<n>` | Einträge mit `seq > after`, aufsteigend, max. 1000 (Standard 500). Antwort `{ records: [{ id, seq, updatedAt, deleted, schema, ciphertext, deviceId }], more, latestSeq }`. |

- Push: Die 5 MB gelten für den ganzen Request-Body (sonst `too_large`). 0 oder mehr als 500
  Einträge, eine `id` oder Blob-ID, die nicht 16 Bytes Base64url ist, `schema` < 1, ein
  `ciphertext` unter 28 Bytes oder mehr als 16 Blobs pro Eintrag: `bad_request`. Höchstens
  60 Pushes pro Minute und Konto (`rate_limited`).
- Pull: `after` und `limit` sind ganze Zahlen ≥ 0 bzw. ≥ 1, sonst `bad_request`. Ein `limit`
  über 1000 zählt als 1000. `after=0` bekommt nie `gone`.
- Ist `after` größer als `latestSeq`, wurde eine Server-Sicherung zurückgespielt. Antwort:
  `410` mit Code `server_restored`. Das Gerät gewinnt: Es lädt **alle** lokalen synchronisierten
  Zeilen erneut hoch (wie beim ersten Einschalten) und holt danach alles ab `after=0`. Haben
  zwei Geräte verschiedene Stände, gewinnt das zuletzt synchronisierende (bewusst akzeptiert).
- Auch Löschungen tragen einen `ciphertext` (Klartext mit `row: null`). So bleibt der Schlüssel
  `k` für das Gerät lesbar, das die Löschung anwendet.
- Der Server sendet einem Gerät auch seine eigenen Einträge zurück. Der Client erkennt sie an
  `deviceId` und überspringt sie, wenn für den Schlüssel nichts Neueres in `_outbox` liegt.

Tombstones bleiben mindestens 180 Tage. Ein Gerät, das länger offline war (`after` älter als
die älteste aufbewahrte Löschung), bekommt `410 gone` und lädt dann alles neu (`after=0`). Gelöschte Einträge mit `seq` älter
als 180 Tage darf der Server entfernen; er merkt sich die höchste entfernte `seq` pro Konto als
Grenze für `gone`.

### Synchronisierte Tabellen

Alle Tabellen aus `src/db/schema.ts` außer:

- `Holidays` (Cache der Ferien-API, jedes Gerät lädt selbst),
- Einträge in `Settings`, die nur das Gerät betreffen (`DEVICE_SETTING_KEYS` in
  `src/lib/settings.ts`): `holidayCache`, `lastBackup`, `pinHash`, `colorMode`,
  `compactTable`, `compactTimetable`. Der Einstellungs-Tab und die Anzeige-Optionen liegen im
  `localStorage` und sind ohnehin nicht in der DB.

Primärschlüssel je Tabelle (Reihenfolge gilt für `pk` und `k`): `Classes`, `Students`,
`Grades`, `Traits`, `Duties`: `id`; `Classes2Students`: `classId, studentId`;
`Students2Traits`: `studentId, traitId`; `CancelledDays`: `date`; `CancelledLessons`:
`classId, date`; `LessonTypes`: `classId, date, type`; `Reports`: `classId, date, kind`;
`ReportGrades`: `classId, date, kind, studentId`; `SchoolYears`: `year`; `Settings`: `key`.

Lokale Erfassung (Migration 23): Trigger schreiben bei INSERT, UPDATE und DELETE
`(tbl, pk = JSON-Array des Schlüssels, changedAt in ms)` nach `_outbox`, wenn
`_sync_state.enabled = '1'` und `_sync_state.applying != '1'`. Ändert ein UPDATE den
Schlüssel, wird auch der alte Schlüssel erfasst (wird als gelöscht gesendet). Kaskaden über
Fremdschlüssel lösen die Trigger ebenfalls aus. Die Sync-Engine liest beim Senden die
aktuelle Zeile zum Schlüssel; fehlt sie, sendet sie eine Löschung.

Die interne Tabelle `_outbox` und Sync-Tabellen (`_sync_*`) werden nie synchronisiert.

## 5. Fotos

- Fotos stehen lokal weiter als Data-URL in `Students.image`.
- Bilddaten = die UTF-8-Bytes der vollständigen Data-URL (`data:image/…;base64,…`). So bleibt
  der Bildtyp erhalten.
- Beim Sync ersetzt die Engine `image` im Klartext durch `{ "blob": "<blobId>" }`.
  `blobId` = Base64url von `HMAC-SHA256(IDK, "blob|" ‖ SHA-256(Bilddaten))` (Hash als 32 rohe
  Bytes), gekürzt auf 16 Bytes.
- Das Foto selbst: AES-256-GCM mit DEK, AAD = `notenfeder/blob/v1/<userId>/<blobId>`.
  Hochgeladen wird `nonce ‖ ciphertext+tag` als `application/octet-stream`.

| Methode, Pfad | Zweck |
|---|---|
| `PUT /blobs/{blobId}` | Hochladen (max. 2 MB). Gibt es den Blob schon: `200` ohne Änderung. |
| `GET /blobs/{blobId}` | Herunterladen. |

- `PUT` antwortet `201` bei neuem Blob, `200` bei vorhandenem (der Body wird dann ignoriert).
  `blobId` muss 16 Bytes Base64url sein, der Body mindestens 28 Bytes (`bad_request`), höchstens
  2 MB (`too_large`).
- `GET` liefert die Bytes als `application/octet-stream` mit
  `Cache-Control: private, max-age=31536000, immutable`. Fremde oder unbekannte IDs: `not_found`.
- Ein hochgeladener Blob ohne Verweis zählt ab dem Upload als verwaist. Der Client pusht den
  Eintrag darum innerhalb von 30 Tagen nach dem Upload.

Der Server löscht Blobs, auf die 30 Tage lang kein Eintrag mehr verweist. Dafür meldet der
Client beim Push die Blob-Referenzen im Klartext-Feld `blobs: [<blobId>]` pro Eintrag
(der Server sieht nur die IDs).

## 6. Gerät koppeln

1. Neues Gerät (angemeldet, aber ohne DEK) erzeugt ein ECDH-P-256-Schlüsselpaar und ruft
   `POST /link` mit seinem öffentlichen Schlüssel auf. Antwort: `{ linkId, code }`.
   `code` = 8 Zeichen Crockford-Base32 (40 Zufallsbits vom Server), gültig 10 Minuten.
   Öffentliche Schlüssel immer im Rohformat (unkomprimierter Punkt, 65 Bytes, `0x04 ‖ x ‖ y`),
   im JSON Base64url.
2. Das neue Gerät zeigt den `code`.
3. Altes Gerät (mit DEK) gibt den `code` ein, holt `GET /link/by-code/{code}` →
   `{ linkId, publicKey }`.
4. Das alte Gerät sendet sofort `POST /link/{linkId}/key` mit `{ publicKey }` (`pubAlt`). Das
   neue Gerät bekommt ihn über `GET /link/{linkId}` (`status: "keyed"`) oder per WebSocket.
   Beide Geräte zeigen dann einen **Prüfcode**: die ersten 4 Bytes von `SHA-256(pubNeu ‖ pubAlt)`
   als vorzeichenlose Zahl (Big Endian) modulo 1 000 000, mit führenden Nullen auf 6 Ziffern.
   Die Nutzerin bestätigt am alten Gerät, dass beide gleich sind; erst dann folgt Schritt 5.
   Das neue Gerät übernimmt die DEK erst nach eigener Bestätigung.
5. Altes Gerät leitet per ECDH (gemeinsames Geheimnis = x-Koordinate, 32 Bytes) plus
   `HKDF(secret, salt="", info="notenfeder/link/v1")` einen Schlüssel ab, wrappt die DEK wie in 3
   mit `kind = link` (AAD `notenfeder/wrap/v1/link/<userId>`) und sendet
   `POST /link/{linkId}/complete` mit `{ publicKey, wrapped }`.
6. Neues Gerät holt das Ergebnis (`GET /link/{linkId}` →
   `{ status: "waiting" | "keyed" | "done", publicKey?, wrapped? }`, oder per WebSocket-Nachricht), packt
   die DEK aus. Nach dem ersten Abruf mit `done` löscht der Server die Kopplung.

`linkId` ist eine UUID vom Server. Ein falscher `code` zählt zum Rate-Limit der
`auth`-Endpunkte; nach 5 Fehlversuchen für ein Konto verfallen dessen offene Kopplungen.

Nur Geräte desselben Kontos dürfen eine Kopplung abschließen.

- Alle `/link`-Endpunkte brauchen eine Sitzung. Unbekannte, abgelaufene und fremde Kopplungen
  geben gleich `not_found`. Der Server normalisiert den eingegebenen `code` (siehe 1).
- `publicKey` muss ein gültiger P-256-Punkt sein, `wrapped` genau 60 Bytes, sonst
  `bad_request`. `key` und `complete` antworten `204`, ein zweites `complete`: `conflict`.
  `complete` (und ein weiteres `key`) mit einem anderen `publicKey` als bei `key`: `conflict`.
  Das neue Gerät bricht ab, wenn sich `publicKey` zwischen `keyed` und `done` ändert.
- Die WebSocket-Nachricht `link` geht an alle Geräte des Kontos; das neue Gerät erkennt seine
  `linkId`.

## 7. WebSocket

`GET /ws?token=…`. Nachrichten vom Server, JSON mit Feld `type` und den Feldern daneben,
z. B. `{"type":"changed","latestSeq":42,"deviceId":"…"}`:

| Typ | Inhalt | Bedeutung |
|---|---|---|
| `hello` | `{ latestSeq }` | Nach dem Verbinden. |
| `changed` | `{ latestSeq, deviceId }` | Neue Einträge. Der Client zieht per `pull`. |
| `revoked` | `{}` | Dieses Gerät ist gesperrt. Danach schließt der Server. |
| `link` | `{ linkId }` | Kopplung abgeschlossen. |

Der Client sendet alle 30 Sekunden `{"type":"ping"}`. Ohne Ping 90 Sekunden lang schließt der
Server. Bei Abbruch verbindet der Client neu mit Backoff (1 s bis 60 s).

- Ungültiges Token: normale Fehlerantwort (`401`) statt Upgrade. Fremde Origin: `403`.
- `changed` geht an alle Geräte des Kontos, auch an das Gerät, das gepusht hat (`deviceId`
  zeigt es). `latestSeq` ist die `seq` des letzten Eintrags im Push.
- Jede Client-Nachricht zählt als Ping (max. 1 KB). Close-Codes: `1008` nach `revoked`, `1013`,
  wenn das Gerät mehr als 16 Nachrichten zurückliegt (neu verbinden, dann `pull`).

## 8. Schutz

- Rate-Limits pro IP für alle `auth`-Endpunkte (z. B. 10 pro Minute), pro Konto für `push`.
- Maximale Größen wie oben. Maximal 10 Geräte und 20 Passkeys pro Konto.
- Logs ohne Tokens, ohne Chiffretext, ohne IP länger als 7 Tage.

## Änderungen

| Datum | Stream | Änderung |
|---|---|---|
| 2026-11-23 | 0 | Entwurf verbindlich gemacht: Codierungen (Base32, HKDF-Salt, GCM-Format), Fehler-Status, Wrap- und Geräte-JSON, Pull-Felder, Blob-Eingabe, Prüfcode-Formel ergänzt. Code-Abfrage der Kopplung als `GET /link/by-code/{code}`, damit sie sich vom Pfad mit `linkId` unterscheidet. Wiederherstellungsschlüssel mit 4 statt 1 Prüfzeichen (36 Zeichen = 9 Vierergruppen, 20 Bit Fehlererkennung). |
| 2026-11-23 | A | Passkeys: Body von `begin`, `204` bei weiterem Passkey, User-ID = `userId`, PRF-Salt schon in den Optionen, Fehlercodes, max. 20 Passkeys. |
| 2026-11-23 | A | Pull: `gone` auch bei `after` > `latestSeq` (Server-Sicherung zurückgespielt). |
| 2026-11-23 | A | Statt `gone` bei `after` > `latestSeq` neuer Code `server_restored` (410): Gerät lädt alles hoch (Entscheidung Mario, blockers.md). Betrifft Stream B. |
| 2026-11-23 | A | `DELETE /account`: `204`, `revoked` an alle Geräte. |
| 2026-11-23 | A | Kopplung: Sitzung nötig, einheitlich `not_found`, Prüfung von Schlüssel und Wrap, `204`/`conflict` bei `complete`, `link` an alle Geräte des Kontos. |
| 2026-11-23 | A | WebSocket: Fehler vor dem Upgrade, `changed` auch an das pushende Gerät, Close-Codes. |
| 2026-11-23 | A | Fotos: `201`/`200` bei `PUT`, Prüfregeln, Cache-Header bei `GET`, Verwaist-Zeit ab Upload. |
| 2026-11-23 | A | Einträge: Prüfregeln für Push und Pull, Push-Limit 60 pro Minute und Konto, `limit` über 1000 wird gekürzt. |
| 2026-11-23 | A | Schlüssel: `204` bei `PUT`/`DELETE`, Prüfregeln für `PUT`, `conflict` beim letzten `recovery`-Wrap. |
| 2026-11-23 | A | OIDC: Anbieter-Namen, `404` bei abgeschaltetem Anbieter, Redirect-URI aus dem `Origin`-Header, `204` beim Verknüpfen, `conflict` bei fremder Identität. |
| 2026-11-23 | A | Fehlercode `internal` (500). Test-Login `POST /auth/dev/login`. Form von `identities` in `GET /auth/session`, `204` bei Logout, Sperren, Umbenennen, Länge der Gerätenamen. |
| 2026-11-24 | – | OIDC: Redirect-URI ohne Query (`<Origin>/` statt `<Origin>/?oidc=callback`), weil Microsoft keine Query erlaubt. |
| 2026-11-24 | – | OIDC: Scope `email`, `exchange` gibt `email` zurück (nur zur Anzeige, nicht gespeichert). App ohne Passkey-Login und -Registrierung ohne Sitzung. |
| 2026-11-24 | – | Freischaltung (`approved`, `403 not_approved`), Kontakt-Adresse und Begründung (`PUT /account/contact`, Felder in `GET /auth/session`). |
| 2026-11-24 | – | Kopplung: `POST /link/{linkId}/key` und Status `keyed`, damit beide Geräte den Prüfcode vor der Bestätigung zeigen. |
| 2026-11-24 | – | Genau ein Anmeldeweg pro Konto: `exchange` mit Sitzung gibt `409 conflict` (kein Verknüpfen mehr). |
