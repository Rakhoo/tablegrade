# Notenfeder – Hinweise für Claude Code

## Wer und wie

- Ich bin **Mario** (Git-User „Rakhoo“). Ich entwickle Notenfeder für meine Frau, eine
  Lehrerin, die die App auf ihrem Schul-iPad nutzt. Repo, Cloudflare-Projekt, Datenbankdatei
  (`tablegrade.sqlite3`) und PIN-Salt heißen weiter „tablegrade“ – nicht umbenennen.
- **Erinnerungen/Memories nur über mich (Mario) speichern, nie über meine Frau.** Die
  Account-E-Mail gehört ihr – nicht verwenden.
- Mit mir **Deutsch** sprechen. Code und Kommentare **Englisch**, JSDoc an exportierten
  Funktionen/Komponenten, nicht überladen. Alle UI-Texte **Deutsch**.
- **Commits:** Nie ungefragt committen. Erst wenn ich „committen“ oder Ähnliches sage:
  committen **und** pushen (beides zusammen), Message einzeilig, englisch.
  - **Auf `main`** behalte ich die Oberhand: Dort committe und pushe ich selbst. Auf Nachfrage
    nur die Commit-Message liefern, auf Basis der gestagten Änderungen (`git diff --staged`).
    Ist nichts oder nicht alles gestagt, vorher fragen, ob gestagt werden soll – als Auswahl
    mit Buttons (AskUserQuestion), nicht als Text-Frage.
  - Löst ein Push einen Workflow aus, obwohl der Commit nichts für ihn Relevantes ändert, die
    Message mit `[skip deploy]` (Deploy, Server-Image; nur auf `main`) bzw. `[skip ci]`
    (alle Workflows, z. B. CI bei reinen Doku-Änderungen auf `sync/**`) versehen.
  - Keine Commit-Message ungefragt im Bericht.
- Prüfen mit `npx tsc -b --noEmit`, `npm run lint`, `npm run build`. **Keine Browser-Tests**,
  außer ich melde ein konkretes Problem oder eine Änderung erfordert es ausdrücklich. Ehrlich
  sagen, was geprüft wurde und was nicht. Nach Code-Änderungen vor dem Bericht den
  Projekt-Skill `clean-check` (`.claude/skills/clean-check/`) anwenden.
- Entscheidungen mit vernünftigem Standard selbst treffen und im Bericht nennen; nur bei echten
  Weichenstellungen nachfragen.
- Bei Feature-Änderungen die `README.md` mitpflegen (Prettier nicht auf die README anwenden, es
  formatiert sonst das ganze Dokument um; auf `src/` ist Prettier in Ordnung).

## Kontext sparsam halten

- Nur lesen, was für die Aufgabe nötig ist: gezielt mit `grep`/Ausschnitten statt ganzer
  Dateien, keine langen Ausgaben, keine Wiederholung früherer Schritte.
- Antworten kurz: was geändert wurde, was entschieden wurde, was offen/ungetestet ist.
- Kommunikation mit mir größtenteils nach ASD-STE100 (Simplified Technical English), auf
  Deutsch übertragen: kurze Sätze (Anweisungen max. 20 Wörter, Beschreibungen max. 25), eine
  Anweisung pro Satz, Aktiv, einfache und einheitliche Begriffe, keine Füllwörter oder
  Redewendungen, Schritte als Liste. Ausführlicher nur, wenn ich danach frage.
- Dass Älteres aus dem Gespräch vergessen wird, ist kein Problem – maßgeblich sind der Code,
  die README und diese Datei.

## Ziel der App

Offline-PWA für Lehrkräfte: Wochen-Stundenplan, Sitzplan pro Stunde (Ermahnen, Bewerten,
Kommentieren, Anordnen), Übersichtstabelle pro Klasse und Halbjahr mit Noten, Klausuren,
Projekten, Nachklausuren/Projektverlängerungen, Teil- und Halbjahresnoten, Export (PDF/CSV),
Klassen-Editor mit Schülerlisten (auch WebUntis-PDF), Namen lernen, Einstellungen mit Sicherung.

**Datenschutz ist zentral:** Alle Daten liegen auf dem Gerät (SQLite im Browser). Keine
Analytics, keine Daten an fremde Dienste. Ferien kommen von mehr-schulferien.de (ohne
personenbezogene Daten). Optional (in den Einstellungen, standardmäßig aus): Konto und
Synchronisierung über Marios eigenen Server mit **Ende-zu-Ende-Verschlüsselung** – der Server
sieht nur Chiffretext, gewrappte Schlüssel, HMAC-IDs und Zeitstempel. Anmeldung per Passkey,
Microsoft oder Google; außer diesen Anmeldungen keine fremden Dienste. Ohne Konto läuft die App
wie bisher. Die App läuft nur installiert (im Browser-Tab nur Installationsanleitung;
`npm run dev`/lokal läuft im Tab).

## Tech-Stack (fest)

- React 19, TypeScript, Vite, **VitePWA**, **SQLocal** (OPFS, braucht COOP/COEP) + **Drizzle**,
  MUI (+ MUI X Date Pickers), Tailwind CSS 4, React Router (Hash-Routing), date-fns,
  pdfjs-dist (WebUntis-Import), jsPDF (Export).
- Krypto und Sync im Client nur mit Browser-APIs (WebCrypto, WebAuthn, IndexedDB, fetch,
  WebSocket); Tests mit Vitest (`npm test`, Gesamttest gegen den Server `npm run test:e2e`).
- Sync-Server: **Go** in `server/` (SQLite über `modernc.org/sqlite`, WebAuthn, OIDC,
  WebSocket), läuft per Docker Compose auf einem Raspberry Pi, erreichbar über Tailscale Funnel.
- Hosting: Cloudflare Pages über GitHub Actions; `public/_headers` setzt COOP/COEP. Server-Image
  baut GitHub Actions nach GHCR, ein systemd-Timer auf dem Pi zieht es.
- Nicht: Klartext-Daten auf dem Server, Tracking, fremde Cloud-Backends. Keine neuen
  Abhängigkeiten ohne Rückfrage.
- Die in VitePWA `includeAssets` und als apple-touch-icon genannten Dateien müssen existieren
  (Ausnahme: `mask-icon.svg`).
- DB: `BASELINE` in `src/db/migrations.ts` ist das Schema des ersten Release (Version 20, wie die
  Daten auf dem iPad). Neue Migrationen nur anhängen (append-only, nie bestehende ändern).

## Orientierung im Code

- `README.md`: Features, Projektstruktur, Routen, State-Konzept, Datenmodell – zuerst dort
  nachsehen.
- UI-Muster: Funktionen einer Seite im Speed Dial (`SpeedDial.tsx`) bzw. Modus-Leiste
  (`ModeBar.tsx`); jedes erklärbare Element bekommt ein `data-help`-Attribut mit deutschem Text
  für die Hilfe (Karten mit inneren Elementen: `data-help-group`; dieselbe Erklärung an vielen
  Elementen: `data-help-repeat`; siehe README).
- Geteilter Zustand: Rückgängig-Verlauf `useEditHistory`, Anzeige-Optionen `useDisplayOption`;
  Daten kommen über die Route-Loader und werden nach Änderungen per `useRevalidator` neu geladen.

## Ordnerstruktur (einhalten)

- `src/features/<seite>/`: je Route ein Ordner mit `<Name>Page.tsx` und `<name>Loader.ts`,
  dazu die nur dort genutzten Komponenten (z. B. `overview/TableCells.tsx`). Wird eine Seite
  groß, in Teilkomponenten im selben Ordner zerlegen statt eine Datei wachsen zu lassen
  (Richtwert: Komponenten-Dateien unter ~500 Zeilen).
- `src/components/`: von mehreren Seiten genutzte UI (`PageHeader`, `SpeedDial` +
  `speedDialEntries`, `ModeBar`, Dialoge, Icons); zusammengehörige größere Teile als
  Unterordner (`components/help/`).
- `src/hooks/`: wiederverwendbare Hooks und geteilter UI-Zustand.
- `src/lib/`: reine Logik ohne Seiteneffekte (keine DOM-/DB-Zugriffe), z. B. Notenregeln
  (`createMarkRules` in `lessonChains.ts` – nicht in Seiten nachbauen), `gradeTools`, `paths`.
- `src/services/`: Seiteneffekte nach außen (Ferien-API, Backup, PWA, PDF-Import/-Export).
- `src/crypto/`: reine Krypto-Logik mit WebCrypto (kein DOM, keine DB). `src/sync/`: Konto und
  Sync (Netz, DB), Regeln wie `src/services/`; die UI nutzt nur `src/sync/index.ts`.
- `server/`: Go-Server des Syncs, eigenes `go.mod` (siehe `server/README.md`).
- `src/db/`: Schema, Migrationen, Client; Zugriffe nur über `src/db/queries/*`, exportiert
  über `src/db/index.ts`.
- URLs nur über `paths` (`src/lib/paths.ts`) bauen, nie als String-Literal; neue Routen in
  `router.tsx`, `paths.ts` und den Seitennamen in `lib/returnPage.ts` eintragen.

## Coding-Regeln (einhalten)

- Funktionskomponenten mit benannten Exports, PascalCase-Dateien für Komponenten, camelCase
  für alles andere. Props als eigener `type <Name>Props`.
- React: abgeleitete Werte im Render berechnen statt in State/Effects zu spiegeln; Effects nur
  für echte Synchronisation mit außen (DOM, Storage, Listener). Stabile Keys aus Daten, keine
  Array-Indizes; keine Objekt-/Array-Literale als Default-Props (Modul-Konstante nutzen).
- Wiederholtes (Kopfzeile, Speed-Dial-Einträge, Regeln, Rückweg) über die vorhandenen
  Bausteine lösen statt kopieren; Doppeltes beim Anfassen zusammenführen.
- Kurz und lesbar: frühe Returns, kleine benannte Hilfsfunktionen, keine toten Imports oder
  Variablen, keine verdeckten Namen (no-shadow).
- Kommentare: JSDoc (`/** … */`) an Exports, Komponenten, Props-Feldern und lokalen
  Hilfsfunktionen; Inline-`//` nur für nicht offensichtliche Schritte innerhalb einer Funktion.
  Englisch, knapp, erklärt das Warum statt das Was.
- Lint-Regeln in `.oxlintrc.json` nicht abschwächen; Ausnahmen nur einzeln per
  `oxlint-disable-next-line` mit kurzer Begründung darüber.
- Prettier auf `src/` nach Änderungen ausführen.

## Sync-Projekt (abgeschlossen)

- Umgesetzt nach `docs/sync-plan/`; offene Fragen in `docs/sync-plan/blockers.md`, Schritte für
  Mario in `docs/sync-plan/manual-steps.md`. Die Regeln für autonome Sessions dort gelten nicht
  mehr; es gilt diese Datei.
- Protokoll zwischen App und Server: `docs/sync-plan/protocol.md`. Änderungen daran immer in
  Server, Client und Tests zugleich.
