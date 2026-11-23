# notenfeder-server

Sync-Server für Notenfeder. Er speichert Konten, Geräte, gewrappte Schlüssel und
verschlüsselte Einträge und Fotos. Klartext sieht er nie. Protokoll:
[../docs/sync-plan/protocol.md](../docs/sync-plan/protocol.md).

Stand: Speicher (SQLite), Sitzungen, Geräte, Test-Login, Rate-Limits, Passkeys. Die übrigen Endpunkte
baut Stream A ([../docs/sync-plan/tasks-a-server.md](../docs/sync-plan/tasks-a-server.md)).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `cmd/notenfeder-server/` | Einstieg: Konfiguration laden, HTTP-Server, sauberes Beenden |
| `internal/config/` | Konfiguration aus Umgebungsvariablen |
| `internal/api/` | Routen unter `/api/v1`, CORS, Fehlerformat |
| `internal/auth/` | Sitzungen, Passkey-Challenges |
| `internal/oidc/` | Microsoft und Google: Codetausch, ID-Token prüfen; `oidctest/` ist ein Test-Anbieter |
| `internal/ratelimit/` | Rate-Limits pro IP bzw. Konto (Token-Bucket im Speicher) |
| `internal/store/` | Store-Interface (Datenmodell, Fehler) |
| `internal/store/sqlite/` | SQLite-Umsetzung: WAL, eine Schreib-Verbindung, Migrationen nur anhängen |
| `internal/store/storetest/` | Gemeinsame Tests für jede Store-Umsetzung (später auch Postgres) |
| `internal/hub/` | WebSocket-Benachrichtigungen pro Konto (Interface, Umsetzung im Speicher) |
| `internal/blob/` | Verschlüsselte Fotos als Dateien (`DATA_DIR/blobs/<userId>/<blobId>`), Interface für später S3 |
| `internal/vectors/` | Lädt die Testvektoren für Tests |
| `testdata/` | `vectors.json` und das Skript `gen-vectors.mjs`, das sie erzeugt |

## Lokale Entwicklung

Voraussetzung: Go (Version laut `go.mod`).

```sh
cd server
go run ./cmd/notenfeder-server   # startet auf :8080, Daten in ./data/notenfeder.sqlite3
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
| `DEV_AUTH` | leer | `1` schaltet den Test-Login `POST /api/v1/auth/dev/login` ein (nur für Tests, nie in Produktion) |
| `TRUST_FORWARDED_FOR` | leer | `1` nimmt die Client-IP für Rate-Limits aus dem letzten `X-Forwarded-For`-Eintrag (hinter Tailscale Funnel setzen) |
| `OIDC_MICROSOFT_CLIENT_ID` | leer | Microsoft-Login (Mandant `consumers`). Leer = aus |
| `OIDC_MICROSOFT_CLIENT_SECRET` | leer | Pflicht, wenn die Microsoft-Client-ID gesetzt ist (Plattform „Web“) |
| `OIDC_GOOGLE_CLIENT_ID` | leer | Google-Login. Leer = aus |
| `OIDC_GOOGLE_CLIENT_SECRET` | leer | Pflicht, wenn die Google-Client-ID gesetzt ist |

Secrets gehören nicht ins Repo. Auf dem Pi stehen sie in der `.env` neben der
Compose-Datei (siehe [../docs/sync-plan/manual-steps.md](../docs/sync-plan/manual-steps.md)).

## Betrieb

Beim Start und danach alle 24 Stunden läuft `Server.Maintain`:

- Löschungen (Tombstones) älter als 180 Tage entfernen.
- Fotos löschen, auf die 30 Tage lang kein Eintrag verweist.
- Abgelaufene Kopplungen löschen.
- Datenbank-Sicherung per `VACUUM INTO` nach `DATA_DIR/backup/notenfeder-<JJJJ-MM-TT>.sqlite3`.
  Pro Tag eine Datei, die letzten 7 bleiben. Fotos liegen als Dateien in `DATA_DIR/blobs/`.

Logs: JSON-Zeilen auf stderr. Pro Anfrage eine Zeile mit Route-Muster, Status und Dauer. Die
Logs enthalten keine Tokens, keinen Chiffretext, keine Query und keine Client-IP. Nur
Go-interne Verbindungsfehler können eine IP nennen; die Docker-Log-Rotation begrenzt, wie lange
sie liegen.

## Raspberry Pi

Ziel: Der Server läuft im Container, Tailscale Funnel macht ihn per HTTPS erreichbar, ein
systemd-Timer holt neue Images, rclone kopiert die Sicherungen in einen Cloud-Speicher.
Die Dateien liegen in `server/deploy/`.

### Einrichten

1. Raspberry Pi OS (64 Bit) installieren. Docker mit Compose-Plugin installieren:
   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # danach neu anmelden
   ```
2. Ordner anlegen und Dateien kopieren:
   ```sh
   sudo mkdir -p /opt/notenfeder && sudo chown $USER /opt/notenfeder
   cd /opt/notenfeder
   # compose.yaml, .env.example, notenfeder-update.service und .timer aus server/deploy/ hierher
   cp .env.example .env && chmod 600 .env
   ```
3. Datenordner für den Container-Nutzer (UID 65532) anlegen:
   ```sh
   sudo install -d -o 65532 -g 65532 -m 700 data
   mkdir -p rclone
   ```
4. Bei GHCR anmelden. Auf GitHub ein Token (classic) nur mit `read:packages` anlegen, dann:
   ```sh
   docker login ghcr.io -u Rakhoo   # Passwort = Token
   ```
5. `.env` ausfüllen: Client-IDs und Secrets von Microsoft und Google
   (siehe `docs/sync-plan/manual-steps.md`, Abschnitt 7), `RCLONE_REMOTE`. `DEV_AUTH` leer lassen.
6. rclone-Ziel einrichten (z. B. OneDrive oder Google Drive). Die Konfiguration landet in
   `./rclone/rclone.conf`:
   ```sh
   docker run --rm -it -v "$PWD/rclone:/config/rclone" rclone/rclone:1.75 config
   ```
   Den Namen des Remotes plus Ordner in `.env` eintragen, z. B. `RCLONE_REMOTE=onedrive:notenfeder`.
7. Starten und prüfen:
   ```sh
   docker compose up -d
   curl http://127.0.0.1:8080/api/v1/health
   ```
8. Tailscale installieren und den Port freigeben:
   ```sh
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   sudo tailscale funnel --bg 8080
   tailscale funnel status   # zeigt https://<pi-name>.<tailnet>.ts.net
   ```
   Diese Adresse trägt die App als Server ein. Test: `https://<adresse>/api/v1/health`.
9. Automatische Updates einschalten:
   ```sh
   sudo cp notenfeder-update.service notenfeder-update.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now notenfeder-update.timer
   systemctl list-timers notenfeder-update.timer
   ```

### Update

GitHub Actions baut bei jedem Push auf `main` mit Änderungen in `server/` ein Image für arm64
und amd64 (`.github/workflows/server-image.yml`, Tags `latest` und Commit-SHA). Der Timer prüft
alle 30 Minuten und startet den Container neu, wenn es ein neues Image gibt. Sofort
aktualisieren: `sudo systemctl start notenfeder-update.service`.

Steuerung per Commit-Message wie bei `deploy.yml`: `[skip deploy]` baut nichts,
`[deploy dev]` pusht nur den Tag `dev`. Den Dev-Stand nutzt der Pi nur mit `SERVER_TAG=dev`
in der `.env`. Zurück auf einen alten Stand: `SERVER_TAG=<commit-sha>`, dann
`docker compose up -d server`.

Watchtower wird nicht genutzt: `containrrr/watchtower` ist seit Dezember 2025 archiviert. Der
Timer braucht kein weiteres Image mit Zugriff auf den Docker-Socket.

### Sicherung zurückspielen

1. Server anhalten: `docker compose stop server`.
2. Gewünschte Sicherung holen, falls sie nicht mehr lokal liegt:
   ```sh
   docker run --rm -v "$PWD/rclone:/config/rclone" -v "$PWD/restore:/restore" \
     rclone/rclone:1.75 copy "<remote>/backup/notenfeder-<datum>.sqlite3" /restore
   ```
   Fotos genauso: `copy "<remote>/blobs" /restore/blobs`.
3. Datei einsetzen (WAL-Dateien der alten Datenbank entfernen):
   ```sh
   sudo cp restore/notenfeder-<datum>.sqlite3 data/notenfeder.sqlite3
   sudo rm -f data/notenfeder.sqlite3-wal data/notenfeder.sqlite3-shm
   sudo chown -R 65532:65532 data
   ```
4. `docker compose start server`. Änderungen nach der Sicherung fehlen dann auf dem Server.
   Geräte, die schon weiter waren, bekommen beim nächsten Pull `410 gone` und laden alles neu
   (offene Frage zum Wieder-Hochladen: `docs/sync-plan/blockers.md`).

### Logs

`docker compose logs -f server`. Die Logs rotieren bei 10 MB (3 Dateien).
