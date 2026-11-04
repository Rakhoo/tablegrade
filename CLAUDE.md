# tablegrade – Hinweise für Claude Code

## Wer und wie

- Ich bin **Mario** (Git-User „Rakhoo“). Ich entwickle tablegrade für meine Frau, eine Lehrerin,
  die die App auf ihrem Schul-iPad nutzt.
- **Erinnerungen/Memories nur über mich (Mario) speichern, nie über meine Frau.** Die
  Account-E-Mail gehört ihr – nicht verwenden.
- Mit mir **Deutsch** sprechen. Code und Kommentare **Englisch**, JSDoc an exportierten
  Funktionen/Komponenten, nicht überladen. Alle UI-Texte **Deutsch**.
- **Ich committe selbst.** Nicht committen. Auf Nachfrage eine einzeilige englische
  Commit-Message für die gestagten Änderungen liefern.
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
- DB-Migrationen in `src/db/migrations.ts` sind append-only (nie bestehende ändern).

## Orientierung im Code

- `README.md`: Features, Projektstruktur, Routen, State-Konzept, Datenmodell – zuerst dort
  nachsehen.
- Seiten liegen in `src/features/*` (je Route eigene Seite + Loader), geteilte UI in
  `src/components`, reine Logik in `src/lib`, DB-Zugriff in `src/db/queries`.
- UI-Muster: Funktionen einer Seite im Speed Dial (`SpeedDial.tsx`) bzw. Modus-Leiste
  (`ModeBar.tsx`); jedes erklärbare Element bekommt ein `data-help`-Attribut mit deutschem Text
  für die Hilfe.
- Geteilter Zustand: Rückgängig-Verlauf `useEditHistory`, Anzeige-Optionen `useDisplayOption`;
  Daten kommen über die Route-Loader und werden nach Änderungen per `useRevalidator` neu geladen.
