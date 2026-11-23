# Protokoll (Entwurf)

Stream 0 macht diesen Entwurf verbindlich: Lücken füllen, Testvektoren in
`server/testdata/` anlegen, Status unten auf „verbindlich“ setzen. Danach ändern Streams A–D
das Protokoll nur gemeinsam: Änderung hier eintragen, im Abschnitt „Änderungen“ vermerken,
in progress.md ankündigen.

Status: **Entwurf**

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
- Jede Antwort trägt `X-Protocol-Version: 1`. Sendet der Client eine höhere
  Hauptversion als der Server kennt: `upgrade_required`.

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
| `GET  /auth/session` | Prüfung der Sitzung: `{ userId, deviceId, identities[], devices[] }`. |
| `POST /auth/logout` | Sitzung beenden. |
| `GET  /devices` / `POST /devices/{id}/revoke` / `PATCH /devices/{id}` | Geräte auflisten, sperren, umbenennen. |
| `DELETE /account` | Konto mit allen Daten löschen (nach Bestätigung in der UI). |

Antwort bei erfolgreicher Anmeldung:
`{ "sessionToken", "userId", "deviceId", "isNewUser" }`.

Microsoft: Mandant `consumers` (nur private Konten). Google: normale OAuth-Client-ID vom Typ
„Webanwendung“. Redirect-URI ist die App-Origin mit Pfad `/` und Query `?oidc=callback`.

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
- **recovery:** 20 Zufallsbytes (160 Bit). Anzeige als Crockford-Base32 plus 1 Prüfzeichen,
  in Vierergruppen mit `-`. KEK = `HKDF-SHA256(bytes, salt="", info="notenfeder/kek/recovery/v1")`.
  Kein langsames KDF nötig, die Entropie ist hoch genug.
- **org:** später (Master-Key der Schule, öffentlicher Schlüssel). Das Format `alg` lässt Platz.

| Methode, Pfad | Zweck |
|---|---|
| `GET /keys` | Alle Wraps des Kontos. |
| `PUT /keys/{id}` | Wrap anlegen oder ersetzen (z. B. neuer Passkey, neuer Wiederherstellungsschlüssel). |
| `DELETE /keys/{id}` | Wrap löschen. Der letzte `recovery`-Wrap lässt sich nicht löschen. |

## 4. Einträge

```
records  userId, id, seq, updatedAt, deleted, schema, ciphertext, deviceId
```

- `id` = Base64url von `HMAC-SHA256(IDK, "<tabelle>|<primärschlüssel>")`, gekürzt auf 16 Bytes.
  Der Primärschlüssel ist die UUID bzw. bei zusammengesetzten Schlüsseln die Werte in
  Schema-Reihenfolge, getrennt mit `|`. So verrät die ID weder Tabelle noch Datum.
- `seq` vergibt der Server, streng steigend pro Konto.
- Klartext vor der Verschlüsselung:
  `{ "t": "<tabelle>", "k": [<primärschlüssel>], "v": <schema-version>, "row": { … } | null }`.
  `row: null` bei Löschung.
- Verschlüsselung: AES-256-GCM mit DEK, Nonce 12 Zufallsbytes, AAD = `notenfeder/record/v1/<userId>/<id>`.
  `ciphertext` = `nonce ‖ ciphertext+tag`.
- `schema` = Version der lokalen DB (wie `BASELINE_VERSION + Migrationen`), unverschlüsselt,
  damit ein altes Gerät neue Einträge erkennt und zurückstellt.

| Methode, Pfad | Zweck |
|---|---|
| `POST /records/push` | Body: `{ records: [{ id, deleted, schema, ciphertext }] }`, max. 500 Einträge bzw. 5 MB. Antwort: `{ results: [{ id, seq, updatedAt }] }`. Last Write Wins: der neue Eintrag ersetzt immer den alten. |
| `GET /records/pull?after=<seq>&limit=<n>` | Einträge mit `seq > after`, aufsteigend, max. 1000. Antwort `{ records, more, latestSeq }`. |

Tombstones bleiben mindestens 180 Tage. Ein Gerät, das länger offline war (`after` älter als
die älteste aufbewahrte Löschung), bekommt `410` und lädt dann alles neu.

### Synchronisierte Tabellen

Alle Tabellen aus `src/db/schema.ts` außer:

- `Holidays` (Cache der Ferien-API, jedes Gerät lädt selbst),
- Einträge in `Settings`, die nur das Gerät betreffen. Stream 0 legt die Liste fest
  (z. B. zuletzt geöffneter Einstellungs-Tab, Entwickler-Optionen).

Die interne Tabelle `_outbox` und Sync-Tabellen (`_sync_*`) werden nie synchronisiert.

## 5. Fotos

- Fotos stehen lokal weiter als Data-URL in `Students.image`.
- Beim Sync ersetzt die Engine `image` im Klartext durch `{ "blob": "<blobId>" }`.
  `blobId` = Base64url von `HMAC-SHA256(IDK, "blob|" + SHA-256(Bilddaten))`, 16 Bytes.
- Das Foto selbst: AES-256-GCM mit DEK, AAD = `notenfeder/blob/v1/<userId>/<blobId>`.

| Methode, Pfad | Zweck |
|---|---|
| `PUT /blobs/{blobId}` | Hochladen (max. 2 MB). Gibt es den Blob schon: `200` ohne Änderung. |
| `GET /blobs/{blobId}` | Herunterladen. |

Der Server löscht Blobs, auf die 30 Tage lang kein Eintrag mehr verweist. Dafür meldet der
Client beim Push die Blob-Referenzen im Klartext-Feld `blobs: [<blobId>]` pro Eintrag
(der Server sieht nur die IDs).

## 6. Gerät koppeln

1. Neues Gerät (angemeldet, aber ohne DEK) erzeugt ein ECDH-P-256-Schlüsselpaar und ruft
   `POST /link` mit seinem öffentlichen Schlüssel auf. Antwort: `{ linkId, code }`.
   `code` = 8 Zeichen Crockford-Base32, gültig 10 Minuten.
2. Das neue Gerät zeigt den `code`.
3. Altes Gerät (mit DEK) gibt den `code` ein, holt `GET /link/{code}` → öffentlicher Schlüssel.
4. Beide Geräte zeigen einen **Prüfcode**: die ersten 6 Ziffern aus
   `SHA-256(pubNeu ‖ pubAlt)` als Zahl. Die Nutzerin bestätigt am alten Gerät, dass sie gleich
   sind.
5. Altes Gerät leitet per ECDH plus HKDF (`info="notenfeder/link/v1"`) einen Schlüssel ab,
   wrappt die DEK und sendet `POST /link/{linkId}/complete` mit `{ publicKey, wrapped }`.
6. Neues Gerät holt das Ergebnis (`GET /link/{linkId}` oder per WebSocket-Nachricht), packt
   die DEK aus.

Nur Geräte desselben Kontos dürfen eine Kopplung abschließen.

## 7. WebSocket

`GET /ws?token=…`. Nachrichten vom Server, JSON:

| Typ | Inhalt | Bedeutung |
|---|---|---|
| `hello` | `{ latestSeq }` | Nach dem Verbinden. |
| `changed` | `{ latestSeq, deviceId }` | Neue Einträge. Der Client zieht per `pull`. |
| `revoked` | `{}` | Dieses Gerät ist gesperrt. Danach schließt der Server. |
| `link` | `{ linkId }` | Kopplung abgeschlossen. |

Der Client sendet alle 30 Sekunden `{"type":"ping"}`. Ohne Ping 90 Sekunden lang schließt der
Server. Bei Abbruch verbindet der Client neu mit Backoff (1 s bis 60 s).

## 8. Schutz

- Rate-Limits pro IP für alle `auth`-Endpunkte (z. B. 10 pro Minute), pro Konto für `push`.
- Maximale Größen wie oben. Maximal 10 Geräte und 20 Passkeys pro Konto.
- Logs ohne Tokens, ohne Chiffretext, ohne IP länger als 7 Tage.

## Änderungen

| Datum | Stream | Änderung |
|---|---|---|
| | | |
