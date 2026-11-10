# Notenfeder – Hinweise für Claude Code

## Wer und wie

- Ich bin **Mario** (Git-User „Rakhoo“). Ich entwickle Notenfeder für meine Frau, eine
  Lehrerin, die die App auf ihrem Schul-iPad nutzt. Repo, Cloudflare-Projekt, Datenbankdatei
  (`tablegrade.sqlite3`) und PIN-Salt heißen weiter „tablegrade“ – nicht umbenennen.
- **Erinnerungen/Memories nur über mich (Mario) speichern, nie über meine Frau.** Die
  Account-E-Mail gehört ihr – nicht verwenden.
- Mit mir **Deutsch** sprechen. Code und Kommentare **Englisch**, JSDoc an exportierten
  Funktionen/Komponenten, nicht überladen. Alle UI-Texte **Deutsch**.
- **Ich committe selbst.** Nicht committen. Commit-Messages **nur auf Nachfrage** liefern, nicht
  ungefragt im Bericht – dann einzeilig, englisch, auf Basis der gestagten Änderungen
  (`git diff --staged`).
- Prüfen mit `npx tsc -b --noEmit`, `npm run lint`, `npm run build`. **Keine Browser-Tests**,
  außer ich melde ein konkretes Problem oder eine Änderung erfordert es ausdrücklich. Ehrlich
  sagen, was geprüft wurde und was nicht.
- Entscheidungen mit vernünftigem Standard selbst treffen und im Bericht nennen; nur bei echten
  Weichenstellungen nachfragen.
- Bei Feature-Änderungen die `README.md` mitpflegen (Prettier nicht auf die README anwenden, es
  formatiert sonst das ganze Dokument um; auf `src/` ist Prettier in Ordnung).

## Kontext sparsam halten

- Nur lesen, was für die Aufgabe nötig ist: gezielt mit `grep`/Ausschnitten statt ganzer
  Dateien, keine langen Ausgaben, keine Wiederholung früherer Schritte.
- Antworten kurz: was geändert wurde, was entschieden wurde, was offen/ungetestet ist.
- Dass Älteres aus dem Gespräch vergessen wird, ist kein Problem – maßgeblich sind der Code,
  die README und diese Datei.

## Ziel der App

Offline-PWA für Lehrkräfte: Wochen-Stundenplan, Sitzplan pro Stunde (Ermahnen, Bewerten,
Kommentieren, Anordnen), Übersichtstabelle pro Klasse und Halbjahr mit Noten, Klausuren,
Projekten, Nachklausuren/Projektverlängerungen, Teil- und Halbjahresnoten, Export (PDF/CSV),
Klassen-Editor mit Schülerlisten (auch WebUntis-PDF), Namen lernen, Einstellungen mit Sicherung.

**Datenschutz ist zentral:** Alle Daten bleiben auf dem Gerät (SQLite im Browser). Kein Backend,
keine Accounts, keine Analytics, keine Daten an externe Dienste. Einzige Netzwerkabfrage: Ferien
von mehr-schulferien.de (ohne personenbezogene Daten). Die App läuft nur installiert
(im Browser-Tab nur Installationsanleitung; `npm run dev`/lokal läuft im Tab).

## Tech-Stack (fest)

- React 19, TypeScript, Vite, **VitePWA**, **SQLocal** (OPFS, braucht COOP/COEP) + **Drizzle**,
  MUI (+ MUI X Date Pickers), Tailwind CSS 4, React Router (Hash-Routing), date-fns,
  pdfjs-dist (WebUntis-Import), jsPDF (Export).
- Hosting: Cloudflare Pages über GitHub Actions; `public/_headers` setzt COOP/COEP.
- Nicht: Backend, Server-Datenbank, Accounts, Tracking. Keine neuen Abhängigkeiten ohne
  Rückfrage.
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
