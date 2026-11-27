# notenfeder-server

Sync server for Notenfeder. It stores accounts, devices, wrapped keys and encrypted records
and photos. It never sees plaintext.

## Structure

| Folder | Content |
|---|---|
| `cmd/notenfeder-server/` | Entry point: load configuration, HTTP server, clean shutdown |
| `internal/config/` | Configuration from environment variables |
| `internal/api/` | Routes under `/api/v1`, CORS, error format |
| `internal/auth/` | Sessions, passkey challenges |
| `internal/oidc/` | Microsoft and Google: code exchange, ID token check; `oidctest/` is a test provider |
| `internal/ratelimit/` | Rate limits per IP or account (token bucket in memory) |
| `internal/store/` | Store interface (data model, errors) |
| `internal/store/sqlite/` | SQLite implementation: WAL, one write connection, append-only migrations |
| `internal/store/storetest/` | Shared tests for every store implementation (later also Postgres) |
| `internal/hub/` | WebSocket notifications per account (interface, in-memory implementation) |
| `internal/blob/` | Encrypted photos as files (`DATA_DIR/blobs/<userId>/<blobId>`), interface for S3 later |
| `internal/vectors/` | Loads the test vectors for tests |
| `testdata/` | `vectors.json` and the script `gen-vectors.mjs` that generates it |

The interface to the app is described in [docs/protocol.md](../docs/protocol.md).

## Local development

Requirement: Go (version as in `go.mod`).

```sh
cd server
go run ./cmd/notenfeder-server   # starts on :8080, data in ./data/notenfeder.sqlite3
go vet ./... && go test ./...
```

Regenerate the test vectors (only after a protocol change):

```sh
node server/testdata/gen-vectors.mjs
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `LISTEN_ADDR` | `:8080` | Address of the HTTP server |
| `DATA_DIR` | `./data` | SQLite file and photo folder |
| `APP_ORIGINS` | `https://tablegrade.pages.dev,https://dev.tablegrade.pages.dev` | Allowed app origins (CORS, WebAuthn), comma-separated. Only `https://` or `http://localhost…` |
| `RP_ID` | `tablegrade.pages.dev` | WebAuthn RP ID |
| `DEV_AUTH` | empty | `1` enables the test sign-in `POST /api/v1/auth/dev/login` (tests only, never in production) |
| `TRUST_FORWARDED_FOR` | empty | `1` takes the client IP for rate limits from the last `X-Forwarded-For` entry (set it behind Tailscale Funnel) |
| `OIDC_MICROSOFT_CLIENT_ID` | empty | Microsoft sign-in (tenant `consumers`). Empty = off |
| `OIDC_MICROSOFT_CLIENT_SECRET` | empty | Required when the Microsoft client id is set (platform "Web") |
| `OIDC_GOOGLE_CLIENT_ID` | empty | Google sign-in. Empty = off |
| `OIDC_GOOGLE_CLIENT_SECRET` | empty | Required when the Google client id is set |

Secrets do not belong in the repo. On the Pi they are in the `.env` next to the compose file.

## Operation

At start and every 24 hours afterwards, `Server.Maintain` runs:

- Remove deletions (tombstones) older than 180 days.
- Delete photos no record has referenced for 30 days.
- Delete expired device links.
- Database backup via `VACUUM INTO` to `DATA_DIR/backup/notenfeder-<YYYY-MM-DD>.sqlite3`. One
  file per day, the last 7 are kept. Photos are files in `DATA_DIR/blobs/`.

Logs: JSON lines on stderr. One line per request with route pattern, status and duration. The
logs contain no tokens, no ciphertext, no query and no client IP. Only Go-internal connection
errors can name an IP; the Docker log rotation limits how long they stay.

## Raspberry Pi

Goal: the server runs in a container, Tailscale Funnel makes it reachable via HTTPS, a systemd
timer fetches new images, rclone copies the backups to cloud storage. The files are in
`server/deploy/`.

### Setup

1. Install Raspberry Pi OS (64 bit). Install Docker with the compose plugin:
   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # sign in again afterwards
   ```
2. Create the folder and copy the files:
   ```sh
   sudo mkdir -p /opt/notenfeder && sudo chown $USER /opt/notenfeder
   cd /opt/notenfeder
   # compose.yaml, .env.example, notenfeder-update.service and .timer from server/deploy/ here
   cp .env.example .env && chmod 600 .env
   ```
3. Create the data folder for the container user (UID 65532):
   ```sh
   sudo install -d -o 65532 -g 65532 -m 700 data
   mkdir -p rclone
   ```
4. Sign in to GHCR. On GitHub create a token (classic) with only `read:packages`, then:
   ```sh
   docker login ghcr.io -u Rakhoo   # password = token
   ```
5. Fill in `.env`: client ids and secrets of Microsoft and Google, `RCLONE_REMOTE`. Leave
   `DEV_AUTH` empty.
6. Set up the rclone target (e.g. OneDrive or Google Drive). The configuration ends up in
   `./rclone/rclone.conf`:
   ```sh
   docker run --rm -it -v "$PWD/rclone:/config/rclone" rclone/rclone:1.75 config
   ```
   Enter the remote's name plus folder in `.env`, e.g. `RCLONE_REMOTE=onedrive:notenfeder`.
7. Start and check:
   ```sh
   docker compose up -d
   curl http://127.0.0.1:8080/api/v1/health
   ```
8. Install Tailscale and expose the port:
   ```sh
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   sudo tailscale funnel --bg 8080
   tailscale funnel status   # shows https://<pi-name>.<tailnet>.ts.net
   ```
   The app uses this address as its server. Test: `https://<address>/api/v1/health`.
9. Turn on automatic updates:
   ```sh
   sudo cp notenfeder-update.service notenfeder-update.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now notenfeder-update.timer
   systemctl list-timers notenfeder-update.timer
   ```

### Update

GitHub Actions builds an image for arm64 and amd64 on every push to `main` that changes
`server/` (`.github/workflows/server-image.yml`, tags `latest` and the commit SHA). A push to
`dev` always builds only the tag `dev`. The timer checks every 30 minutes and restarts the
container when there is a new image. Update right away:
`sudo systemctl start notenfeder-update.service`.

Steered by the commit message like `deploy.yml`: `[skip deploy]` builds nothing,
`[deploy dev]` on `main` pushes only the tag `dev`. The Pi uses the dev state only with
`SERVER_TAG=dev` in `.env`. Back to an old state: `SERVER_TAG=<commit-sha>`, then
`docker compose up -d server`.

Watchtower is not used: `containrrr/watchtower` has been archived since December 2025. The
timer needs no further image with access to the Docker socket.

### Restore a backup

1. Stop the server: `docker compose stop server`.
2. Fetch the wanted backup if it is not local anymore:
   ```sh
   docker run --rm -v "$PWD/rclone:/config/rclone" -v "$PWD/restore:/restore" \
     rclone/rclone:1.75 copy "<remote>/backup/notenfeder-<date>.sqlite3" /restore
   ```
   Photos the same way: `copy "<remote>/blobs" /restore/blobs`.
3. Put the file in place (remove the WAL files of the old database):
   ```sh
   sudo cp restore/notenfeder-<date>.sqlite3 data/notenfeder.sqlite3
   sudo rm -f data/notenfeder.sqlite3-wal data/notenfeder.sqlite3-shm
   sudo chown -R 65532:65532 data
   ```
4. `docker compose start server`. Changes after the backup are then missing on the server.
   Devices that were further along get `410 server_restored` on their next pull and upload
   all their data again (see docs/protocol.md 4).

### Approve accounts

New accounts wait for approval. They leave a contact address and a short reason. Commands
(run next to the server in the container):

```sh
docker compose exec server /notenfeder-server admin pending            # waiting accounts
docker compose exec server /notenfeder-server admin list               # all accounts
docker compose exec server /notenfeder-server admin approve <id|mail>  # approve
docker compose exec server /notenfeder-server admin revoke <id|mail>   # take back
docker compose exec server /notenfeder-server admin emails             # addresses for mailings
docker compose exec server /notenfeder-server admin delete <id|mail>   # preview: which account
docker compose exec server /notenfeder-server admin delete <id> --ja   # delete account, data and photos
```

The server sends no mails. After `approve`, notify the person yourself. For mailings about
maintenance or payment, use the list from `admin emails` as BCC. The app notices the approval
at the next start, when switching to the app or via "Status prüfen".

`admin delete` deletes like "Konto löschen" in the app: database rows and photos at once. The
daily backups keep the account for at most 7 days, the trash of the cloud storage for up to 30
more. Connected devices notice it at their next request (`unauthorized`).

### Logs

`docker compose logs -f server`. The logs rotate at 10 MB (3 files).
