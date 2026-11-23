# Was nur Mario tun kann

## 1. Routinen und Limits

- **5-Stunden-Limit:** Läufe in dieser Zeit scheitern. Der nächste stündliche Lauf nach dem
  Reset macht weiter. Nichts zu tun.
- **Stream fertig:** Steht ein Stream in progress.md als fertig, seine Routine löschen.
- **Wochenlimit:** Alle Routinen mit dem Schalter oben auf ihrer Detailseite pausieren. Nach
  dem Reset wieder einschalten. Die Einstellungen bleiben erhalten.

## 2. Fortschritt prüfen

- [progress.md](progress.md) und [blockers.md](blockers.md) auf `sync/integration` bzw. den
  Stream-Branches lesen.
- Blocker beantworten: Antwort direkt in blockers.md schreiben und auf den betroffenen Branch
  pushen. Der nächste Lauf liest sie.

## 3. Raspberry Pi einrichten (vor dem ersten echten Test)

Die genaue Anleitung schreibt Stream A in `server/README.md`. Überblick:

1. Raspberry Pi OS 64-Bit, Docker mit Compose.
2. Tailscale installieren, anmelden, Funnel für den Server-Port einschalten. Die Adresse
   `https://<pi-name>.<tailnet>.ts.net` notieren.
3. GitHub-Token mit `read:packages` anlegen, auf dem Pi `docker login ghcr.io`.
4. `server/deploy/compose.yaml` und `.env` auf den Pi kopieren, Werte eintragen.
5. rclone-Ziel für das Backup einrichten (z. B. OneDrive), Konfiguration ins Volume legen.
6. `docker compose up -d`. `GET <adresse>/api/v1/health` muss antworten.

## 4. Anmelde-Apps registrieren (kostenlos)

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

## 5. Frontend konfigurieren

- Commits mit `[deploy dev]` landen auf `dev.tablegrade.pages.dev`, mit `[skip deploy]`
  nirgends. Gut für Tests der Sync-Funktion, bevor deine Frau sie bekommt.
- Variable `VITE_SYNC_URL` = Tailscale-Adresse im Build von Cloudflare Pages
  (GitHub-Actions-Variable in `deploy.yml` übergeben; das ist ein kleiner Schritt in Stream D
  oder von dir).

## 6. Tests auf echten Geräten (nur Mario)

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

## 7. Abschluss

`sync/integration` prüfen und selbst nach `main` mergen. Danach baut Actions das Server-Image,
Watchtower aktualisiert den Pi, Cloudflare Pages deployt die App.
