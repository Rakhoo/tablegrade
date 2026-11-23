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
