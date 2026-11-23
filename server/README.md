# notenfeder-server

Sync-Server für Notenfeder. Er speichert Konten, Geräte, gewrappte Schlüssel und
verschlüsselte Einträge und Fotos. Klartext sieht er nie. Protokoll:
[../docs/sync-plan/protocol.md](../docs/sync-plan/protocol.md).

Stand: Gerüst (Konfiguration, `GET /api/v1/health`, CORS, Protokoll-Header). Die Endpunkte
baut Stream A ([../docs/sync-plan/tasks-a-server.md](../docs/sync-plan/tasks-a-server.md)).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `cmd/notenfeder-server/` | Einstieg: Konfiguration laden, HTTP-Server, sauberes Beenden |
| `internal/config/` | Konfiguration aus Umgebungsvariablen |
| `internal/api/` | Routen unter `/api/v1`, CORS, Fehlerformat |
| `internal/auth/` | Passkeys, OIDC (Microsoft, Google), Sitzungen |
| `internal/store/` | Store-Interface (Datenmodell, Fehler) |
| `internal/store/sqlite/` | SQLite-Umsetzung: WAL, eine Schreib-Verbindung, Migrationen nur anhängen |
| `internal/store/storetest/` | Gemeinsame Tests für jede Store-Umsetzung (später auch Postgres) |
| `internal/hub/` | WebSocket-Benachrichtigungen |
| `internal/blob/` | Verschlüsselte Fotos als Dateien |
| `internal/vectors/` | Lädt die Testvektoren für Tests |
| `testdata/` | `vectors.json` und das Skript `gen-vectors.mjs`, das sie erzeugt |

## Lokale Entwicklung

Voraussetzung: Go (Version laut `go.mod`).

```sh
cd server
go run ./cmd/notenfeder-server   # startet auf :8080, Daten in ./data
go vet ./... && go test ./...
```

Testvektoren neu erzeugen (nur bei einer Protokolländerung):

```sh
node server/testdata/gen-vectors.mjs
```

## Konfiguration

| Variable | Standard | Bedeutung |
|---|---|---|
| `LISTEN_ADDR` | `:8080` | Adresse des HTTP-Servers |
| `DATA_DIR` | `./data` | SQLite-Datei und Foto-Ordner |
| `APP_ORIGINS` | `https://tablegrade.pages.dev,https://dev.tablegrade.pages.dev` | Erlaubte App-Origins (CORS, WebAuthn), kommagetrennt. Nur `https://` oder `http://localhost…` |
| `RP_ID` | `tablegrade.pages.dev` | WebAuthn-RP-ID |
| `OIDC_MICROSOFT_CLIENT_ID` | leer | Microsoft-Login (Mandant `consumers`). Leer = aus |
| `OIDC_MICROSOFT_CLIENT_SECRET` | leer | Optional (öffentlicher Client mit PKCE) |
| `OIDC_GOOGLE_CLIENT_ID` | leer | Google-Login. Leer = aus |
| `OIDC_GOOGLE_CLIENT_SECRET` | leer | Pflicht, wenn die Google-Client-ID gesetzt ist |

Secrets gehören nicht ins Repo. Auf dem Pi stehen sie in der `.env` neben der
Compose-Datei (siehe [../docs/sync-plan/manual-steps.md](../docs/sync-plan/manual-steps.md)).
