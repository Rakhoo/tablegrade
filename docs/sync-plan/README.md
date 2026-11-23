# Umsetzungsplan: Konto, Verschlüsselung und Sync

Dieser Plan setzt die Teile Backend, Login und Verschlüsselung aus
[../konzept-sync-und-lizenzen.md](../konzept-sync-und-lizenzen.md) um. Er gilt zuerst nur für
**eine Nutzerin** (Marios Frau), ohne Zusatzkosten und ohne Partner. Das Ergebnis muss sich
später um Org-Kunden, Master-Key, Bezahlung und VIDIS erweitern lassen.

Der Plan ist für autonome Claude-Sessions geschrieben. Lies zuerst diese Datei ganz, dann
[protocol.md](protocol.md), dann die Aufgabenliste deines Streams.

## 1. Entscheidungen (fest)

| Thema | Entscheidung |
|---|---|
| Plattform | PWA bleibt (Cloudflare Pages). Kein App Store. |
| Backend | **Go**, Ordner `server/` in diesem Repo, eigenes `go.mod`. |
| Server-Datenbank | SQLite über `modernc.org/sqlite` (reines Go, kein CGO). Zugriff nur über ein Store-Interface, damit Postgres später möglich ist. |
| Betrieb | Raspberry Pi (arm64) bei Mario zu Hause, Docker Compose. |
| Erreichbarkeit | Tailscale Funnel (feste HTTPS-Adresse `*.ts.net`). Läuft auf dem Pi-Host, nicht im Container. |
| Server-Update | GitHub Actions baut bei Push auf `main` ein arm64-Image nach GHCR (Repo privat). Watchtower auf dem Pi zieht es automatisch. |
| Server-Backup | Täglicher SQLite-Snapshot plus Fotos per rclone in einen kostenlosen Cloud-Speicher. Ziel per Konfiguration. |
| Login (Identität) | Passkey (WebAuthn) als Hauptweg, dazu privates **Microsoft**-Konto und **Google**-Konto (OIDC). Mehrere Identitäten pro Konto. |
| Schlüssel auf neues Gerät | Passkey mit PRF, Gerät koppeln (Kopplungscode), Wiederherstellungsschlüssel. Alle drei. |
| Wiederherstellungsschlüssel | Zeichengruppen, Crockford-Base32 mit Prüfsumme, z. B. `K7QF-M2XA-…`. |
| Entsperren im Alltag | Keine PIN (`PIN_LOCK_ENABLED` bleibt `false`). Der Schlüssel liegt im IndexedDB des Geräts. |
| Login-Prüfung | Beim Start, alle 15 Minuten und bei jeder Verbindung. Offline bleibt die App benutzbar. |
| Gesperrte Anmeldung | **Nur Hinweis**: Die App arbeitet lokal weiter, zeigt einen Hinweis und synchronisiert erst nach neuer Anmeldung. |
| Umfang | Alle Daten inklusive Fotos und Einstellungen. Ausnahmen: Ferien-Cache, gerätespezifische Einstellungen (Liste in protocol.md). |
| IDs | **Alle** bisherigen Integer-IDs werden Text-UUIDs (Migration, siehe Stream 0). |
| Konflikte | Last Write Wins pro Eintrag, Reihenfolge nach Server-Nummer `seq`. |
| Umstieg | Neuer Bereich „Konto & Synchronisierung“ in den Einstellungen, standardmäßig aus. Beim Einschalten lädt das Gerät alle lokalen Daten hoch. Ohne Konto läuft die App wie heute. |
| Tests | Go-Tests und Vitest. Keine Browser-Tests. |

### Selbst getroffene Annahmen (bei Bedarf ändern)

- **Kopplungscode statt QR:** Das neue Gerät zeigt einen kurzen Code, das alte Gerät gibt ihn
  ein (oder umgekehrt). Grund: QR scannen braucht in Safari eine Kamera-Bibliothek, und ein
  QR-Link öffnet auf dem iPad Safari statt der installierten PWA. QR kann später dazukommen.
- **OAuth-Codetausch auf dem Server:** Der Browser holt den Code per PKCE, der Server tauscht
  ihn ein. Google verlangt dafür ein Client-Secret, das gehört nicht in den Browser.
- **Datenschlüssel im IndexedDB ist exportierbar.** Grund: Er muss für neue Passkeys und
  Kopplungen neu gewrappt werden. Das Risiko ist gleich dem der unverschlüsselten lokalen
  SQLite-Datei.
- **Kopplung mit ECDH P-256** (WebCrypto überall verfügbar) und einem Prüfcode, den beide Geräte
  zeigen. Damit kann der Server nicht dazwischen.

## 2. Architektur

```
iPad / PC (PWA)                                   Raspberry Pi
┌───────────────────────────────┐                 ┌──────────────────────────────┐
│ App (unverändert, SQLite OPFS)│                 │ notenfeder-server (Go)       │
│   │ Trigger schreiben _outbox │   HTTPS + WSS   │  /api/auth/*  Passkey, OIDC  │
│ Sync-Engine (src/sync/)       │◄──────────────► │  /api/records push/pull      │
│   verschlüsselt pro Eintrag   │  Tailscale      │  /api/blobs   Fotos          │
│ Krypto (src/crypto/)          │  Funnel         │  /api/link    Kopplung       │
│   Schlüssel in IndexedDB      │                 │  /ws          Benachrichtigung│
└───────────────────────────────┘                 │ SQLite-Datei + Blob-Ordner   │
                                                  └──────────────────────────────┘
```

- Der Server sieht nur Chiffretext, gewrappte Schlüssel, IDs (HMAC) und Zeitstempel.
- Lokale Änderungen erfasst die App per **SQLite-Trigger** in einer Tabelle `_outbox`. Die
  bestehenden Queries bleiben dadurch fast unverändert.
- Eingehende Änderungen schreibt die Sync-Engine direkt in die lokalen Tabellen. Danach
  lädt die App per `useRevalidator` neu.

### Ordner

```
server/                  Go-Modul (cmd/notenfeder-server, internal/...), Dockerfile, compose
server/testdata/         gemeinsame Testvektoren (JSON), von Go- und Vitest-Tests gelesen
src/crypto/              Schlüssel, Wraps, Wiederherstellungsschlüssel, Eintrags-Verschlüsselung
src/sync/                API-Client, Sync-Engine, WebSocket, Status
src/features/settings/   UI „Konto & Synchronisierung“ (Teilkomponenten im selben Ordner)
docs/sync-plan/          dieser Plan, Fortschritt, Blocker
```

`src/crypto/` und `src/sync/` sind neue Ordner. `src/crypto/` ist reine Logik mit WebCrypto
(kein DOM, keine DB). `src/sync/` hat Seiteneffekte (Netz, DB) und folgt sonst den Regeln von
`src/services/`. Die Ordnerstruktur in CLAUDE.md und README wird entsprechend ergänzt.

## 3. Branches und Streams

| Branch | Inhalt | Aufgaben |
|---|---|---|
| `sync/integration` | Sammel-Branch, abgezweigt von `main` | – |
| `sync/foundation` | Stream 0: UUIDs, Outbox, Protokoll fertig, Server-Gerüst | [tasks-0-foundation.md](tasks-0-foundation.md) |
| `sync/server` | Stream A: Go-Server komplett, Docker, CI | [tasks-a-server.md](tasks-a-server.md) |
| `sync/client` | Stream B: Krypto und Sync-Engine | [tasks-b-client.md](tasks-b-client.md) |
| `sync/ui` | Stream C: Oberfläche | [tasks-c-ui.md](tasks-c-ui.md) |
| `sync/final` | Stream D: Zusammenführen, Gesamttest, Doku | [tasks-d-integration.md](tasks-d-integration.md) |

Reihenfolge:

1. Stream 0 allein. Er endet mit dem Merge von `sync/foundation` in `sync/integration`.
2. Streams A, B und C parallel. Jeder zweigt von `sync/integration` ab, **nachdem** Stream 0
   gemergt ist, und mergt fertige Teilstücke regelmäßig zurück.
3. Stream D, wenn A, B und C fertig sind.
4. Mario prüft `sync/integration` und mergt selbst nach `main`.

## 4. Regeln für autonome Sessions

Diese Regeln gehen der CLAUDE.md vor, **nur** für Sessions, die diesen Plan abarbeiten.

**Erlaubt:**
- Commits auf dem eigenen Stream-Branch, Push dieses Branches.
- Den Stream-Branch per `git merge --no-ff` in `sync/integration` mergen und
  `sync/integration` pushen, wenn alle Prüfungen grün sind. (In der Cloud blockiert der
  GitHub-Proxy `gh pr`, PRs gibt es darum nicht.)
- `sync/integration` in den eigenen Branch mergen (nie rebasen, was schon gepusht ist).
- Abhängigkeiten **nur** aus Abschnitt 5.

**Verboten:**
- Push, Merge oder PR nach `main`. Force-Push. Löschen fremder Branches.
- Deployen, Secrets anlegen oder ins Repo schreiben, echte OAuth-Client-IDs erfinden.
- Fragen an Mario stellen und darauf warten. Ist eine Aufgabe blockiert: Eintrag in
  [blockers.md](blockers.md), dann mit der nächsten freien Aufgabe weitermachen.
- Bestehende Migrationen ändern. Neue nur anhängen.
- Browser-Tests, Playwright, Puppeteer.

**Vor jedem Push:**
1. `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npx vitest run` (sobald vorhanden).
2. Im Ordner `server/`: `go vet ./...`, `go test ./...`.
3. Prettier auf geänderte Dateien in `src/`.
4. Skill `clean-check` auf die eigenen Änderungen anwenden.
5. Aufgabe in der Aufgabenliste abhaken, Eintrag in [progress.md](progress.md).

**Commit-Messages:** einzeilig, englisch, mit Präfix des Streams, z. B.
`server: add record push and pull endpoints`.

## 5. Erlaubte Abhängigkeiten

| Wo | Paket | Zweck |
|---|---|---|
| Go | Standardbibliothek (`net/http` mit Muster-Routing ab Go 1.22) | Server, Routing, JSON, OAuth-Codetausch |
| Go | `github.com/go-webauthn/webauthn` | Passkey-Registrierung und -Login |
| Go | `github.com/coreos/go-oidc/v3` | Prüfen der ID-Tokens von Microsoft und Google |
| Go | `github.com/coder/websocket` | WebSocket |
| Go | `modernc.org/sqlite` | SQLite ohne CGO |
| Go | indirekte Abhängigkeiten der obigen Pakete | – |
| Client | keine neuen Laufzeit-Pakete | WebCrypto, WebAuthn, IndexedDB, fetch, WebSocket sind nativ |
| Client (dev) | `vitest` | Tests für `src/crypto/` und `src/sync/` |
| Betrieb | Docker-Images `containrrr/watchtower` (oder Nachfolger, siehe blockers.md-Hinweis in Stream A), `rclone/rclone` | Updates, Backup |

Alles andere braucht Marios Zustimmung: Eintrag in [blockers.md](blockers.md).

## 6. Ablauf eines Laufs (Routine)

Jeder Lauf einer Cloud-Routine geht so vor:

1. Repo holen. Auf den Branch des Streams wechseln. Gibt es ihn nicht: von
   `sync/integration` anlegen. Gibt es `sync/integration` nicht (nur Stream 0): von `main`
   anlegen und pushen.
2. **Sperre prüfen:** Ist `docs/sync-plan/locks/<stream>` jünger als 90 Minuten und nicht
   vom eigenen Lauf? Dann sofort enden. Sonst die Datei mit Zeitstempel schreiben, committen,
   pushen.
3. Für A, B, C: Ist Stream 0 noch nicht in `sync/integration` gemergt? Dann sofort enden.
   Für D: Sind A, B, C nicht alle fertig? Dann sofort enden.
4. `sync/integration` in den eigenen Branch mergen.
5. Die nächste offene Aufgabe der eigenen Liste bearbeiten. Höchstens etwa 2 Stunden Arbeit,
   dann sauber beenden. Lieber kleine fertige Schritte als große halbe.
6. Prüfungen aus Abschnitt 4 ausführen, committen, pushen.
7. Ist ein in sich fertiges Teilstück erreicht (in der Liste mit **Merge-Punkt** markiert):
   `sync/integration` holen, den eigenen Branch hineinmergen, Prüfungen dort erneut
   ausführen, `sync/integration` pushen. Schlägt der Push fehl (jemand war schneller):
   neu holen und wiederholen.
8. Sperre löschen, committen, pushen.
9. Sind alle Aufgaben des Streams erledigt: Eintrag „Stream fertig“ in progress.md.

Abgebrochene Läufe (z. B. durch ein Limit) hinterlassen eine Sperre. Sie läuft nach 90 Minuten
ab. Der nächste Lauf prüft zuerst `git status` und den letzten Eintrag in progress.md und
setzt dort fort.

## 7. Was nur Mario tun kann

Siehe [manual-steps.md](manual-steps.md): Routinen pausieren, Pi einrichten,
OAuth-Apps registrieren, Tests auf dem iPad.
