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
Antwort Mario: …
```

---

## 2026-11-23 · Stream C · offen
Frage: Die Fassade (`src/sync/types.ts`) kennt keinen Zustand „Update nötig“
(`upgrade_required`, HTTP 426, protocol.md). Die UI kann ihn darum nicht anzeigen (C1, C5).
Vorschlag der Session: Stream B ergänzt `SyncPhase` um `"upgradeRequired"`, gesetzt bei 426.
Stream C zeigt dann in `lib/syncView.ts` eine eigene Ansicht mit Hinweis und „Neu laden“.
Bis dahin zeigt die UI den Fall als „aktiv“ mit Fehlermeldung (`phase: "error"`).
Antwort Mario: …

## 2026-11-23 · Stream C · offen
Frage: Nach einer Anmeldung mit Microsoft/Google kommt die App per Redirect zurück. Die UI
erfährt dann nicht, ob ein neues Konto entstand (`SignInResult.isNewUser` fehlt). Ein neues
Konto ohne Datenschlüssel sieht aus wie „Schlüssel fehlt“ auf einem neuen Gerät.
Vorschlag der Session: Stream B ergänzt `AccountInfo` um `hasDataKey: boolean` (Server weiß,
ob schon ein Wrap existiert). Stream C zeigt bei `locked` und `hasDataKey == false` den
Ablauf „Schlüssel erstellen“ statt der Entsperr-Wege.
Antwort Mario: …

## 2026-11-23 · Stream C · offen
Frage: Für C2 und C3 fehlen Teile in der Fassade (`src/sync/index.ts`, `types.ts`):
1. Passkey zum Entsperren hinzufügen (C2, C4 „Passkey hinzufügen“) und die Info, ob schon ein
   PRF-Passkey existiert (C2-Angebot, C3 „Mit Passkey entsperren“ nur dann zeigen).
2. Fortschritt von Erst-Upload und Erst-Download (C2, C3).
3. Ob vor dem Erst-Download lokale Daten da sind und ob sie ersetzt werden sollen (C3).
Vorschlag der Session: Stream B ergänzt `addPasskey(): Promise<void>`,
`AccountInfo.hasPrfPasskey: boolean`, `SyncStatus.progress: { done: number; total: number } | null`
(gesetzt während Erst-Upload/-Download) und für C3 `hasLocalData(): Promise<boolean>` plus
`replaceLocalData(): Promise<void>` (Download erst danach). Stream C baut die UI darauf auf.
Antwort Mario: …
