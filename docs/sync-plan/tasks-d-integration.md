# Stream D: Zusammenführen und Gesamttest

Branch: `sync/final`. Start erst, wenn A, B und C in progress.md als fertig stehen.

## D1 Zusammenführen

- [x] `sync/final` von `sync/integration`. Alle Prüfungen grün machen.
- [x] Stubs der Fassade entfernt? UI nutzt überall die echte Engine?
- [x] Protokoll und Umsetzung abgleichen: jeder Endpunkt aus protocol.md hat Server-Code,
      Client-Aufruf und Test.

## D2 Gesamttest ohne Browser

- [x] Vitest-Suite `src/sync/e2e.test.ts` (eigenes Skript `npm run test:e2e`): startet den
      Go-Server mit `DEV_AUTH=1` und temporärem `DATA_DIR`, zwei simulierte Geräte mit
      `node:sqlite`, echte HTTP- und WebSocket-Verbindungen.
- [x] Fälle: Erst-Upload, zweites Gerät per Wiederherstellungsschlüssel, Kopplung, parallele
      Änderungen (Last Write Wins), Löschung mit Kaskade, Foto, Offline-Phase, `410`,
      Gerät sperren (`revoked` als Hinweis), Konto löschen.
- [x] CI führt die Suite aus (Go und Node sind dort vorhanden).

## D3 Dokumentation

- [x] CLAUDE.md: Abschnitt „Datenschutz“ und „Tech-Stack“ an die neue Lage anpassen (Server
      mit Ende-zu-Ende-Verschlüsselung, Go, Raspberry Pi), Ordnerstruktur um `src/crypto/`,
      `src/sync/`, `server/` ergänzen. Abschnitt „Sync-Projekt (autonome Sessions)“ auf
      „abgeschlossen“ setzen.
- [x] README: Datenschutz-Abschnitt, Stack, Entwicklung (Server lokal starten), Deployment.
- [x] manual-steps.md: prüfen, ob alle Werte (Umgebungsvariablen, Redirect-URIs) stimmen.

## D4 Übergabe

- [ ] **Merge-Punkt:** `sync/final` → `sync/integration`.
- [ ] progress.md: Zusammenfassung für Mario: was fertig ist, was getestet ist, was nur auf
      echten Geräten testbar ist, offene Blocker. Kein PR nach `main`, das macht Mario.
