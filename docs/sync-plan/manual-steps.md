# Was nur Mario tun kann

## 1. Start

1. Den Plan in `docs/sync-plan/` lesen und bei Bedarf anpassen.
2. Den Plan auf `main` committen und pushen. Die Routinen lesen ihn von dort.

## 2. Cloud-Umgebung für die Routinen

Die Routinen laufen in der Cloud-Umgebung von Claude Code. Sie brauchen:

- Zugriff auf das Repo `Rakhoo/tablegrade` mit Push-Recht (GitHub-Verbindung von Claude).
- **Node 24** und **Go** (aktuelle Version). Fehlt Go in der Umgebung: im Setup-Skript der
  Umgebung installieren, z. B. das offizielle Archiv von go.dev nach `/usr/local/go` laden
  und `PATH` ergänzen.
- Keine Geheimnisse. Die Sessions brauchen weder OAuth-Werte noch Zugang zum Pi.

## 3. Routinen anlegen

Mit `/schedule` (oder unter claude.ai/code) fünf Routinen anlegen, alle **stündlich**.
Ein Lauf endet sofort, wenn sein Stream noch nicht dran ist oder ein anderer Lauf noch
arbeitet. Du kannst also alle gleich anlegen.

| Name | Prompt |
|---|---|
| `sync-0-foundation` | siehe unten, Stream `0`, Branch `sync/foundation`, Liste `tasks-0-foundation.md` |
| `sync-a-server` | Stream `a`, Branch `sync/server`, Liste `tasks-a-server.md` |
| `sync-b-client` | Stream `b`, Branch `sync/client`, Liste `tasks-b-client.md` |
| `sync-c-ui` | Stream `c`, Branch `sync/ui`, Liste `tasks-c-ui.md` |
| `sync-d-final` | Stream `d`, Branch `sync/final`, Liste `tasks-d-integration.md` |

Prompt-Vorlage (Platzhalter ersetzen):

```
Du arbeitest autonom am Notenfeder-Sync-Projekt im Repo Rakhoo/tablegrade.
Stream: <x>. Branch: <branch>. Aufgabenliste: docs/sync-plan/<liste>.
Lies docs/sync-plan/README.md vollständig und folge Abschnitt 6 genau.
Die Regeln in Abschnitt 4 und 5 gehen der CLAUDE.md vor. Stelle keine Fragen;
Blockiertes kommt nach docs/sync-plan/blockers.md, dann nächste Aufgabe.
Antworte am Ende nur mit einer kurzen Zusammenfassung des Laufs.
```

Wenn ein Stream in progress.md als fertig steht: seine Routine löschen.

## 4. Limits

- **5-Stunden-Limit:** Läufe in dieser Zeit scheitern. Der nächste stündliche Lauf nach dem
  Reset macht weiter. Nichts zu tun.
- **Wochenlimit:** Alle Routinen pausieren. Nach dem Reset wieder einschalten.

## 5. Fortschritt prüfen

- [progress.md](progress.md) und [blockers.md](blockers.md) auf `sync/integration` bzw. den
  Stream-Branches lesen.
- Blocker beantworten: Antwort direkt in blockers.md schreiben und auf den betroffenen Branch
  pushen. Der nächste Lauf liest sie.

## 6. Raspberry Pi einrichten (vor dem ersten echten Test)

Die genaue Anleitung schreibt Stream A in `server/README.md`. Überblick:

1. Raspberry Pi OS 64-Bit, Docker mit Compose.
2. Tailscale installieren, anmelden, Funnel für den Server-Port einschalten. Die Adresse
   `https://<pi-name>.<tailnet>.ts.net` notieren.
3. GitHub-Token mit `read:packages` anlegen, auf dem Pi `docker login ghcr.io`.
4. `server/deploy/compose.yaml` und `.env` auf den Pi kopieren, Werte eintragen.
5. rclone-Ziel für das Backup einrichten (z. B. OneDrive), Konfiguration ins Volume legen.
6. `docker compose up -d`. `GET <adresse>/api/v1/health` muss antworten.

## 7. Anmelde-Apps registrieren (kostenlos)

**Microsoft** (portal.azure.com → App-Registrierungen):
- Kontotyp: nur persönliche Microsoft-Konten.
- Plattform „Web“, Redirect-URIs: `<App-Origin>/?oidc=callback` für Produktion und
  Dev-Vorschau (`https://dev.tablegrade.pages.dev/?oidc=callback`).
- Client-Secret anlegen. Client-ID und Secret in die `.env` auf dem Pi.

**Google** (console.cloud.google.com → APIs & Dienste → Anmeldedaten):
- OAuth-Zustimmungsbildschirm „Extern“, Status „Test“, deine Frau als Testnutzerin.
- OAuth-Client vom Typ „Webanwendung“, beide Redirect-URIs wie oben.
- Client-ID und Secret in die `.env` auf dem Pi.

**App-Origin:** Die Adresse der PWA auf Cloudflare Pages. Sie ist auch `RP_ID` bzw. Origin für
Passkeys. Ändert sich die Domain später, sind alle Passkeys ungültig. Darum vorher festlegen.

## 8. Frontend konfigurieren

- Commits mit `[deploy dev]` landen auf `dev.tablegrade.pages.dev`, mit `[skip deploy]`
  nirgends. Gut für Tests der Sync-Funktion, bevor deine Frau sie bekommt.
- Variable `VITE_SYNC_URL` = Tailscale-Adresse im Build von Cloudflare Pages
  (GitHub-Actions-Variable in `deploy.yml` übergeben; das ist ein kleiner Schritt in Stream D
  oder von dir).

## 9. Tests auf echten Geräten (nur Mario)

Diese Punkte kann keine Session prüfen. Am besten früh testen, sobald A und B gemergt sind:

- [ ] **Microsoft- und Google-Login in der installierten PWA auf dem iPad.** Risiko: iOS
      öffnet die Login-Seite außerhalb der PWA, und die Rückkehr landet in Safari statt in der
      App. Falls ja: in blockers.md melden. Ausweg wäre z. B. ein Login über einen Code, der
      in der App eingegeben wird.
- [ ] Passkey mit iCloud-Schlüsselbund: Anlegen, Login, **PRF** (Entsperren per Passkey).
- [ ] Passkey im Google Passwortmanager bzw. Bitwarden auf dem Windows-PC: Login und PRF.
- [ ] Erst-Upload der echten Daten (vorher eine Sicherung exportieren).
- [ ] Zweites Gerät per Kopplung und per Wiederherstellungsschlüssel.
- [ ] Gleichzeitiges Arbeiten auf zwei Geräten.
- [ ] Gerät sperren: Hinweis erscheint, App bleibt benutzbar.
- [ ] Backup auf dem Pi zurückspielen.

## 10. Abschluss

`sync/integration` prüfen und selbst nach `main` mergen. Danach baut Actions das Server-Image,
Watchtower aktualisiert den Pi, Cloudflare Pages deployt die App.
