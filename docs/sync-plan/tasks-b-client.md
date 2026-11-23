# Stream B: Krypto und Sync-Engine

Branch: `sync/client`. Start erst nach „Stream 0 fertig“.
Arbeitet in `src/crypto/`, `src/sync/`, `src/hooks/useSyncStatus.ts`, minimal in
`src/main.tsx`/`src/App.tsx` (Start der Engine, OIDC-Rückkehr) und `docs/sync-plan/`.
Keine UI außer dem, was Stream C nicht abdeckt. Die Fassade `src/sync/index.ts` aus Stream 0
bleibt die einzige Schnittstelle zur UI; Signaturen nur nach Absprache in progress.md ändern.

Tests mit Vitest. DB-Zugriffe der Engine laufen über ein kleines Interface, damit Tests mit
`node:sqlite` laufen (Hilfsmodul aus Stream 0).

## B1 Krypto (`src/crypto/`)

- [x] Hilfen: Zufall, HKDF-SHA256, AES-256-GCM, HMAC, Base64url, Crockford-Base32.
- [x] DEK erzeugen, importieren, exportieren. IDK ableiten.
- [x] Wraps für `passkey` (aus PRF-Ausgabe) und `recovery`.
- [x] Wiederherstellungsschlüssel: erzeugen, formatieren (Vierergruppen, Prüfzeichen),
      Eingabe normalisieren (Klein-/Großschreibung, Leerzeichen, `O`→`0`, `I`/`L`→`1`),
      Prüfzeichen prüfen mit klarer Fehlermeldung.
- [x] Record-ID, Blob-ID, Record- und Blob-Verschlüsselung.
- [x] Kopplung: ECDH P-256, Ableitung, Prüfcode.
- [x] Alle Testvektoren aus `server/testdata/vectors.json` bestehen.
- [x] **Merge-Punkt.**

## B2 Lokale Speicherung

- [x] IndexedDB-Speicher für DEK, Sitzungs-Token, `userId`, `deviceId`, letzte `seq`
      (oder `_sync_state`, Entscheidung begründen). Gerätespezifisch, nie im Backup-Export.
- [x] Prüfen: Die bestehende Sicherung exportiert die SQLite-Datei. `_sync_state` darf dabei
      keine Geheimnisse enthalten. Beim Import auf ein Gerät mit aktivem Sync: Sync
      ausschalten und Hinweis (Logik hier, Text in Stream C).

## B3 API-Client

- [x] `src/sync/api.ts`: typisierte Aufrufe aller Endpunkte, Fehler in deutsche Meldungen,
      Basis-URL aus `import.meta.env.VITE_SYNC_URL`.
- [x] Sitzungsprüfung: beim Start, alle 15 Minuten, bei `online` und beim Sichtbarwerden.
      `session_revoked` → Status `revoked` (nur Hinweis, lokale Arbeit geht weiter, Sync stoppt).

## B4 Anmeldung (Logik)

- [x] Passkey-Registrierung und -Login mit `navigator.credentials`, PRF-Erweiterung
      (`eval` mit Salt aus protocol.md), Erkennen von `prfCapable`.
- [x] OIDC: PKCE und `state` erzeugen, zur Authorize-URL wechseln, nach Rückkehr
      (`?oidc=callback`) Code an den Server senden, Query aus der URL entfernen. Das
      Hash-Routing darf nicht stören. Gilt für Microsoft und Google.
- [x] Nach dem Login: Wraps holen. DEK vorhanden? Dann entsperrt. Sonst Status „Schlüssel
      fehlt“ mit den Wegen Passkey-PRF, Kopplung, Wiederherstellungsschlüssel.
- [x] Weiteren Passkey hinzufügen (mit Wrap), Identität verknüpfen, neuen
      Wiederherstellungsschlüssel erzeugen (alten Wrap ersetzen), Abmelden.

## B5 Sync-Engine

- [x] Einschalten: `_sync_state.enabled = '1'`, Erst-Upload aller Zeilen aller
      synchronisierten Tabellen in Stapeln mit Fortschritt.
- [x] Push: `_outbox` lesen, je Primärschlüssel die aktuelle Zeile lesen (fehlt sie:
      Löschung), Klartext bauen, verschlüsseln, pushen, erledigte Outbox-Einträge bis zur
      gelesenen `seq` löschen. Änderungen während des Pushs gehen nicht verloren (Test).
- [x] Pull: ab letzter `seq`, entschlüsseln, `schema` neuer als lokal → in
      `_sync_pending` zurückstellen und Status `upgrade_required`. Sonst in einer Transaktion
      mit `applying = '1'` und `PRAGMA defer_foreign_keys = ON` einfügen, ersetzen oder löschen.
      Danach Ereignis für `useRevalidator`.
- [x] `410` → kompletter Neuabgleich ohne Datenverlust lokaler, noch nicht gepushter Änderungen.
- [x] `410 server_restored` (Entscheidung in blockers.md): **alle** lokalen synchronisierten
      Zeilen in `_outbox` stellen, pushen, dann alles ab `after=0` holen. Das Gerät gewinnt.
      Test dazu. Code und Meldung in `src/sync/api.ts` ergänzen.
- [x] Fotos: beim Push Blob hochladen, wenn noch nicht auf dem Server; beim Pull Blob laden und
      als Data-URL in `Students.image` schreiben.
- [x] WebSocket mit Ping und Backoff, `changed` → Pull, `revoked` → Status, `link` → Kopplung.
- [x] Ausschalten: `enabled = '0'`, WebSocket zu, lokale Daten bleiben.
- [x] Zurückgestellte Einträge nach einem App-Update anwenden.
- [x] Tests mit zwei simulierten Geräten (je eine `node:sqlite`-DB) und einem Fake-Server im
      Speicher: Anlegen, Ändern, Löschen mit Kaskade, Foto, Offline-Phase, Last Write Wins,
      `410`, `revoked`, neuere Schema-Version.
- [x] **Merge-Punkt.**

## B7 Fassaden-Ergänzungen für Stream C (Antworten Mario, blockers.md, 2026-11-23)

Signaturen sind mit Mario abgestimmt. Jede Ergänzung auch in `src/sync/demo.ts`, damit
Stream C sie im Demo-Modus nutzen kann. Kleine Teilstücke früh mergen; Stream C wartet darauf.

- [x] `SyncPhase` um `"upgradeRequired"` ergänzen. Setzen bei HTTP 426 und bei
      zurückgestellten Einträgen mit neuerer `schema` (B5 Pull).
- [x] `AccountInfo.hasDataKey: boolean` (Server hat schon einen Wrap). Auch nach der
      OIDC-Rückkehr gesetzt, damit die UI ein neues Konto von einem neuen Gerät unterscheidet.
- [x] `AccountInfo.hasPrfPasskey: boolean` und `addPasskey(): Promise<void>` (neuer Passkey
      mit Wrap, B4-Logik).
- [x] `SyncStatus.progress: { done: number; total: number } | null`, gesetzt während
      Erst-Upload und Erst-Download, sonst `null`.
- [x] `hasLocalData(): Promise<boolean>` und `replaceLocalData(): Promise<void>`; der
      Erst-Download auf einem neuen Gerät startet erst danach.
- [x] `renameDevice(id: string, name: string): Promise<void>` (`PATCH /devices/{id}`).
- [x] `linkOidcIdentity(provider: OidcProvider): Promise<void>`: Redirect wie
      `startOidcLogin`; die Rückkehr verknüpft die Identität mit dem angemeldeten Konto.
- [x] **Merge-Punkt.**

## B6 Kopplung und Konto (Logik)

- [x] Kopplung auf beiden Seiten laut protocol.md 6, mit Prüfcode-Bestätigung.
- [x] Konto löschen: Server-Aufruf, dann lokale Sync-Daten und Schlüssel entfernen, die
      lokale App-DB bleibt (Nutzerin entscheidet in der UI).
- [x] Fassade vollständig umgesetzt (inklusive B7), Stubs entfernt.
- [x] **Merge-Punkt**, „Stream B fertig“ in progress.md.
