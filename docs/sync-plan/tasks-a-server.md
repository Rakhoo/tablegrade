# Stream A: Go-Server

Branch: `sync/server`. Start erst nach „Stream 0 fertig“.
Arbeitet nur in `server/`, `.github/workflows/` (Server-Teile) und `docs/sync-plan/`.
Grundlage: [protocol.md](protocol.md). Jede Funktion mit Go-Tests (`httptest`, SQLite im
Speicher bzw. temporärem Ordner). Keine Tests, die Internet brauchen.

## A1 Speicher

- [x] Interface `store.Store` mit allen Operationen aus protocol.md (Konten, Identitäten,
      Passkeys, Geräte, Sitzungen, Wraps, Einträge, Blob-Referenzen, Kopplungen).
- [x] SQLite-Umsetzung: WAL, `busy_timeout`, eine Schreib-Verbindung, eigene
      Schema-Migrationen (nur anhängen). Postgres soll später ein zweites Paket sein können.
- [x] `seq` pro Konto streng steigend, auch bei parallelen Pushes (Test).

## A2 Grundlagen der API

- [x] Router, JSON-Helfer, Fehlerformat, `X-Protocol-Version`, CORS nur für `APP_ORIGINS`.
- [x] Sitzungen: Token erzeugen, nur Hash speichern, Middleware, Ablauf und Verlängerung,
      `session_revoked`.
- [x] Rate-Limits und Größenlimits laut protocol.md 8.
- [x] Test-Login `POST /api/v1/auth/dev/login`, nur aktiv mit `DEV_AUTH=1`. Er legt ein
      Konto und ein Gerät an. Standard ist aus; beim Start mit `DEV_AUTH=1` eine deutliche
      Warnung loggen. Für Tests von Stream B und D.
- [x] `GET /auth/session`, `POST /auth/logout`, Geräte-Endpunkte.

## A3 Passkeys

- [x] `go-webauthn`: Registrierung (neues Konto oder weiterer Passkey), Login mit
      discoverable credentials. `RP_ID` und erlaubte Origins (`APP_ORIGINS`) aus der Konfiguration.
- [x] PRF-Erweiterung in den Optionen anfordern; ob der Passkey PRF kann, meldet der Client
      beim Abschluss, der Server speichert `prfCapable`.
- [x] Challenges mit Ablauf (5 Minuten) im Speicher oder in der DB.
- [x] **Merge-Punkt.**

## A4 Microsoft und Google

- [x] `GET /auth/oidc/{provider}/config`, `POST /auth/oidc/{provider}/exchange`.
- [x] Codetausch per `net/http` (Client-Secret aus der Umgebung), ID-Token mit `go-oidc`
      prüfen. Microsoft: Mandant `consumers`, Issuer genau prüfen. Google: Issuer
      `https://accounts.google.com`, `email_verified` beachten.
- [x] Mit Sitzung: Identität mit dem Konto verknüpfen. Ohne Sitzung: Login oder neues Konto.
- [x] Tests mit einem eigenen Test-OIDC-Anbieter (`httptest`, eigenes JWKS, Signatur mit
      der indirekten Abhängigkeit `go-jose`).

## A5 Schlüssel

- [x] `GET/PUT/DELETE /keys`. Der letzte `recovery`-Wrap ist nicht löschbar (Test).

## A6 Einträge

- [x] `POST /records/push`, `GET /records/pull` mit Last Write Wins und Limits.
- [x] Tombstones mindestens 180 Tage, danach Aufräumen; `410` bei zu altem `after`.
- [x] **Merge-Punkt.**

## A7 Fotos

- [ ] Interface `blob.Store`, Umsetzung im Dateisystem (`DATA_DIR/blobs/<user>/<id>`),
      später S3-fähig.
- [ ] `PUT/GET /blobs/{id}`, 2 MB Limit, Referenzen aus dem Push, Aufräumen nach 30 Tagen
      ohne Referenz.

## A8 WebSocket

- [ ] `coder/websocket`, Hub pro Konto, Nachrichten laut protocol.md 7, Ping-Zeitlimit.
- [ ] `changed` nach jedem Push, `revoked` beim Sperren eines Geräts (Verbindung danach
      schließen).
- [ ] Hub hinter einem Interface (später mehrere Server-Instanzen möglich).

## A9 Gerät koppeln

- [ ] `POST /link`, `GET /link/{code}`, `POST /link/{linkId}/complete`, `GET /link/{linkId}`,
      Ablauf nach 10 Minuten, nur innerhalb desselben Kontos, WebSocket-Nachricht `link`.
- [ ] **Merge-Punkt.**

## A10 Konto und Betrieb

- [ ] `DELETE /account`: löscht alles des Kontos inklusive Blobs.
- [ ] Tägliches Backup: `VACUUM INTO` nach `DATA_DIR/backup/notenfeder-<datum>.sqlite3`,
      die letzten 7 behalten. Blobs liegen ohnehin als Dateien vor.
- [ ] Strukturierte Logs (`log/slog`) ohne Tokens, Chiffretext und lange gespeicherte IPs.
- [ ] **Merge-Punkt.**

## A11 Docker und Pi

- [ ] `server/Dockerfile`: mehrstufig, statisches Binary (`CGO_ENABLED=0`), kleines
      Laufzeit-Image (z. B. distroless static), Nutzer ohne Root, Plattformen `linux/arm64`
      und `linux/amd64`.
- [ ] `server/deploy/compose.yaml`: Dienste `server` (Port nur auf `127.0.0.1`, Volume
      `/data`), `watchtower` (nur dieses Image, Abfrage z. B. alle 30 Minuten), `backup`
      (`rclone/rclone`, synchronisiert `/data/backup` und `/data/blobs` täglich zum
      konfigurierten Ziel). `.env.example` mit allen Variablen.
- [ ] Prüfen, ob `containrrr/watchtower` noch gepflegt wird. Wenn nicht: gepflegten Fork
      nehmen oder ein systemd-Timer mit `docker compose pull && docker compose up -d`
      (`server/deploy/`). Entscheidung in progress.md begründen.
- [ ] `.github/workflows/server-image.yml`: bei Push auf `main` mit Änderungen in `server/`
      Image für beide Plattformen bauen und nach `ghcr.io/rakhoo/notenfeder-server` pushen
      (Tags `latest` und Commit-SHA). Läuft nur auf `main`, also erst nach Marios Merge.
      Gleiche Steuerung per Commit-Message wie `deploy.yml`: `[skip deploy]` baut nichts,
      `[deploy dev]` pusht nur den Tag `dev` (nicht `latest`, Watchtower bleibt unberührt).
      Manuell startbar mit Auswahl `production`/`dev`.
- [ ] `server/README.md`: Einrichtung des Pi Schritt für Schritt (Docker, GHCR-Login mit
      Token `read:packages`, `.env`, `tailscale funnel`, rclone-Ziel einrichten, Update,
      Backup zurückspielen).

## A12 Abschluss

- [ ] Alle Endpunkte aus protocol.md vorhanden und getestet. Liste in progress.md.
- [ ] **Merge-Punkt**, „Stream A fertig“ in progress.md.
