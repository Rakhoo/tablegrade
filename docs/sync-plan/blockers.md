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
