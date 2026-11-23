# Stream C: Oberfläche

Branch: `sync/ui`. Start erst nach „Stream 0 fertig“.
Arbeitet in `src/features/settings/`, `src/components/`, `README.md` und `docs/sync-plan/`.
Nutzt nur die Fassade `src/sync/index.ts` und `useSyncStatus`. Solange Stream B nicht
gemergt ist, laufen die Stubs.

Regeln aus CLAUDE.md gelten voll: deutsche UI-Texte, `data-help` an jedem erklärbaren
Element, Bausteine wiederverwenden (`PageHeader`, Dialoge, `ConfirmDialog`, Icons in
`components/icons.tsx`), Dateien unter ca. 500 Zeilen, README mitpflegen. Texte für die
Nutzerin kurz und ohne Fachbegriffe (kein „DEK“, „PRF“, „Wrap“).

## C1 Einstellungs-Bereich

- [x] Neuer Tab „Konto & Sync“ in den Einstellungen. Zustände: aus, Einrichtung, Schlüssel
      fehlt, aktiv, gesperrt, Update nötig. (Update nötig: siehe blockers.md)
- [x] Im Zustand „aus“: kurze Erklärung (Daten verschlüsselt, niemand außer ihr kann sie
      lesen, Schlüssel gut aufbewahren) und Knopf „Einrichten“.

## C2 Einrichtung (neues Konto)

- [x] Anmeldeweg wählen: Passkey, Microsoft, Google.
- [ ] Wiederherstellungsschlüssel anzeigen:
      - Formular mit Benutzername „Notenfeder-Wiederherstellung“ und Feld
        `autocomplete="new-password"`, damit der Browser das Speichern anbietet.
      - Knöpfe „Kopieren“, „Drucken“, „Als Datei speichern“.
      - Deutlicher Hinweis: Ohne diesen Schlüssel sind die Daten bei Verlust aller Geräte weg.
        Niemand kann ihn zurücksetzen.
- [ ] Bestätigung: zwei zufällige Vierergruppen eingeben.
- [ ] Angebot „Passkey zum Entsperren hinzufügen“ (wenn noch keiner mit PRF vorhanden).
- [ ] Erst-Upload mit Fortschritt, danach Zustand „aktiv“.

## C3 Neues Gerät

- [ ] Anmelden (Passkey, Microsoft, Google).
- [ ] Zustand „Schlüssel fehlt“: drei Wege
      - „Mit Passkey entsperren“ (nur wenn ein PRF-Passkey vorhanden ist),
      - „Mit anderem Gerät koppeln“: Code anzeigen, danach Prüfcode vergleichen,
      - „Wiederherstellungsschlüssel eingeben“ (Einfügen aus dem Passwortmanager erlaubt).
- [ ] Danach Download aller Daten mit Fortschritt. Hat das Gerät schon lokale Daten: vorher
      fragen (ersetzen oder abbrechen; zusammenführen gibt es nicht).
- [ ] Auf dem alten Gerät: „Gerät koppeln“ mit Code-Eingabe und Prüfcode-Bestätigung.

## C4 Konto verwalten

- [ ] Anmeldewege: Liste, „Passkey hinzufügen“, „Microsoft verknüpfen“, „Google verknüpfen“.
- [ ] Geräte: Liste mit letzter Aktivität, umbenennen, sperren (`ConfirmDialog`).
- [ ] „Neuen Wiederherstellungsschlüssel erstellen“ (gleicher Ablauf wie C2, alter wird ungültig).
- [ ] „Sync ausschalten“, „Abmelden“, „Konto löschen“ (Bestätigung durch Eintippen eines
      Worts; Wahl, ob die Daten auf diesem Gerät bleiben).

## C5 Status in der App

- [ ] Kleiner Sync-Status für alle Seiten (z. B. im `PageHeader` oder neben dem Speed Dial):
      synchronisiert, läuft, offline, Fehler. Mit `data-help`.
- [ ] Hinweis bei „gesperrt“: Die App bleibt benutzbar, Text „Anmeldung abgelaufen, neu
      anmelden, um zu synchronisieren“ mit Knopf. Kein Sperrbildschirm.
- [ ] Hinweis bei „Update nötig“.
- [ ] Hinweis beim Import einer Sicherung mit aktivem Sync (Logik von Stream B).

## C6 Abschluss

- [ ] README: Feature-Abschnitt „Konto & Sync“, Hilfe-Texte, Projektstruktur
      (`src/crypto/`, `src/sync/`, `server/`).
- [ ] **Merge-Punkt**, „Stream C fertig“ in progress.md.
