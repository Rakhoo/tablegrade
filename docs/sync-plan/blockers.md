# Blocker und Fragen an Mario

Sessions tragen hier ein, was sie ohne Mario nicht entscheiden dürfen oder können (z. B.
neue Abhängigkeit, Widerspruch im Plan, Test nur auf echtem Gerät). Danach arbeiten sie an der
nächsten freien Aufgabe weiter.

Mario schreibt seine Antwort unter den Eintrag. Eine Session, die eine Antwort umsetzt,
setzt den Status auf „erledigt“.

```
## <Datum> · Stream <x> · offen
Frage: …
Vorschlag der Session: …
Antwort Mario: Option B – das Gerät gewinnt. Eigener Code `server_restored` (410), das Gerät lädt
alle lokalen Daten hoch und holt danach alles ab `after=0`. Risiko (bei zwei Geräten mit
verschiedenem Stand gewinnt das zuletzt synchronisierende) ist okay. Echtes Konflikt-Handling,
auch für zwei länger offline Geräte, kommt vielleicht in einem späteren Update.
Umsetzung: Server erledigt (Stream A, 2026-11-23). Client: Aufgabe in tasks-b-client.md.
```

---

## 2026-11-23 · Stream A · erledigt
Frage: Was soll ein Gerät tun, wenn der Server nach dem Zurückspielen einer Sicherung `410 gone`
meldet, weil sein `after` größer als `latestSeq` ist? Der Server hat dann die Änderungen nach
der Sicherung verloren, das Gerät hat sie lokal noch.
Vorschlag der Session: Der Server meldet es wie jetzt mit `gone`. Stream B unterscheidet nicht
nach Grund: Nach `gone` lädt das Gerät alles ab `after=0`, behält dabei lokale Zeilen, die neuer
sind als der Server-Stand (oder lädt einfach alle lokalen Daten erneut hoch, wie beim ersten
Einschalten). Alternativ ein eigener Fehlercode `server_restored`. Betrifft Stream B.
Antwort Mario: …

## 2026-11-23 · Stream C · erledigt
Frage: Die Fassade (`src/sync/types.ts`) kennt keinen Zustand „Update nötig“
(`upgrade_required`, HTTP 426, protocol.md). Die UI kann ihn darum nicht anzeigen (C1, C5).
Vorschlag der Session: Stream B ergänzt `SyncPhase` um `"upgradeRequired"`, gesetzt bei 426.
Stream C zeigt dann in `lib/syncView.ts` eine eigene Ansicht mit Hinweis und „Neu laden“.
Bis dahin zeigt die UI den Fall als „aktiv“ mit Fehlermeldung (`phase: "error"`).
Antwort Mario: 1a: Stream B ergänzt `"upgradeRequired"`, Stream C zeigt einen Hinweis mit „Neu laden“. Aufgaben: B7, C7.

## 2026-11-23 · Stream C · erledigt
Frage: Nach einer Anmeldung mit Microsoft/Google kommt die App per Redirect zurück. Die UI
erfährt dann nicht, ob ein neues Konto entstand (`SignInResult.isNewUser` fehlt). Ein neues
Konto ohne Datenschlüssel sieht aus wie „Schlüssel fehlt“ auf einem neuen Gerät.
Vorschlag der Session: Stream B ergänzt `AccountInfo` um `hasDataKey: boolean` (Server weiß,
ob schon ein Wrap existiert). Stream C zeigt bei `locked` und `hasDataKey == false` den
Ablauf „Schlüssel erstellen“ statt der Entsperr-Wege.
Antwort Mario: 2a: Stream B ergänzt `AccountInfo.hasDataKey`, Stream C zeigt dann „Schlüssel erstellen“. Aufgaben: B7, C7.

## 2026-11-23 · Stream C · erledigt
Frage: Für C2 und C3 fehlen Teile in der Fassade (`src/sync/index.ts`, `types.ts`):
1. Passkey zum Entsperren hinzufügen (C2, C4 „Passkey hinzufügen“) und die Info, ob schon ein
   PRF-Passkey existiert (C2-Angebot, C3 „Mit Passkey entsperren“ nur dann zeigen).
2. Fortschritt von Erst-Upload und Erst-Download (C2, C3).
3. Ob vor dem Erst-Download lokale Daten da sind und ob sie ersetzt werden sollen (C3).
Vorschlag der Session: Stream B ergänzt `addPasskey(): Promise<void>`,
`AccountInfo.hasPrfPasskey: boolean`, `SyncStatus.progress: { done: number; total: number } | null`
(gesetzt während Erst-Upload/-Download) und für C3 `hasLocalData(): Promise<boolean>` plus
`replaceLocalData(): Promise<void>` (Download erst danach). Stream C baut die UI darauf auf.
Antwort Mario: Einverstanden wie vorgeschlagen. Aufgaben: B7, C7.

## 2026-11-23 · Stream C · erledigt
Frage: C4 verlangt „Geräte umbenennen“. protocol.md hat `PATCH /devices/{id}`, die Fassade
aber keine Funktion dafür.
Vorschlag der Session: Stream B ergänzt `renameDevice(id, name)` in der Fassade. Stream C ergänzt dann einen Stift-Knopf in
`SyncDevices`.
Antwort Mario: 4a: Stream B ergänzt `renameDevice(id, name)`, Stream C den Stift-Knopf. Aufgaben: B7, C7.

## 2026-11-23 · Stream C · erledigt
Frage: C4 „Microsoft verknüpfen“ / „Google verknüpfen“ braucht eine Fassaden-Funktion, die eine
weitere Identität an das angemeldete Konto hängt (nicht neu anmelden).
Vorschlag der Session: Stream B ergänzt `linkOidcIdentity(provider)` (Redirect wie
`startOidcLogin`, Rückkehr verknüpft statt anmeldet) und `addPasskey()` (siehe oben).
Antwort Mario: 5a: Stream B ergänzt `linkOidcIdentity(provider)`. Aufgaben: B7, C7.

## 2026-11-23 · Stream C · offen
Frage: C5 „Hinweis beim Import einer Sicherung mit aktivem Sync“. B2 legt dafür
`importNotice` im Gerätespeicher ab (`src/sync/importGuard.ts`). Die Fassade
(`src/sync/index.ts`) gibt ihn nicht heraus. Stream C darf nur die Fassade nutzen.
Vorschlag der Session: Stream B ergänzt `SyncStatus.importNotice: boolean` (oder
`hasImportNotice()`) und `dismissImportNotice(): Promise<void>`. Stream C zeigt dann im
`SyncNoticeBanner` und in der Karte „Konto & Sync“: „Sicherung eingespielt. Synchronisierung ist
aus. Zum Fortsetzen neu einschalten.“ mit Knopf „Verstanden“. Kein Vorbau in `demo.ts`, weil
Stream B die Fassade in B6 gerade umbaut (Konfliktgefahr).
Antwort Mario: …
