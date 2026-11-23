# Konzept: Sync, Verschlüsselung und Lizenzen

Stand: November 2026. Entwurf, noch nichts davon ist umgesetzt. Umsetzungsplan für die Einzelnutzung: [sync-plan/README.md](sync-plan/README.md).

Ziel: Notenfeder als bezahlte PWA für Schulen, Schulträger und einzelne Lehrkräfte anbieten.
Die Daten liegen verschlüsselt auf einem Server und synchronisieren zwischen Geräten. Der
Betreiber (Mario) kann die Daten nie lesen.

Angaben zu Recht, Anbietern und Diensten sind nach bestem Wissen. Vor jeder Entscheidung
aktuell prüfen.

## 1. Entscheidungen

| Thema | Entscheidung |
|---|---|
| Plattform | PWA bleibt. Kein App Store vorerst. |
| Datenhaltung | Originaldaten auf dem Server, nur verschlüsselt. SQLite im Browser als Cache und für den Offline-Betrieb. |
| Verschlüsselung | Ende-zu-Ende pro Eintrag, Entschlüsselung nur auf dem Gerät. |
| Konflikte | Last Write Wins pro Eintrag, Zeitstempel vom Server. |
| Kunden | Schulen, Schulträger (Kommune/Kreis) und einzelne Lehrkräfte. Bundesländer später. |
| Login | Microsoft (Schul-Tenant), VIDIS (Landeskonten), Passkey und private Konten für Einzelkunden. |
| Master-Key | Pro Schule. Nur der öffentliche Schlüssel liegt auf dem Server. |

## 2. Verschlüsselung

### Schlüssel in Schichten

- Jede Lehrkraft hat einen zufälligen **Datenschlüssel** (AES-GCM, WebCrypto).
- Der Datenschlüssel wird mehrfach verschlüsselt („gewrappt“). Der Server speichert nur die
  gewrappten Varianten:
  - **Passkey**: Wrapping-Schlüssel aus der WebAuthn-PRF-Erweiterung (Windows Hello, iCloud-
    Schlüsselbund, Google Passwortmanager). Für den Alltag.
  - **Wiederherstellungsschlüssel**: Für ein neues Gerät oder einen verlorenen Passkey.
  - **Master-Key der Schule**: Öffentlicher Schlüssel der Schule (X25519 oder RSA-OAEP). Nur
    bei Org-Kunden.

### Wiederherstellungsschlüssel

1. Die App erzeugt den Schlüssel lokal, z. B. als 24 Wörter oder `K7QF-M2XA-…`.
2. Die App zeigt einen starken Hinweis: Ohne den Schlüssel sind die Daten verloren. Niemand
   kann ihn zurücksetzen.
3. Die App bietet das Speichern an:
   - Formular mit Benutzername „Notenfeder-Wiederherstellung“ und Feld
     `autocomplete="new-password"`. Der Browser bietet dann das Speichern im Passwortmanager an.
   - Drucken.
   - Als Datei speichern.
4. Die Lehrkraft bestätigt die Sicherung, z. B. durch Eingabe von zwei Wörtern.

### Master-Key der Schule

- Die Schule erzeugt ein Schlüsselpaar. Der private Schlüssel bleibt offline bei Schulleitung
  oder Administration.
- Der Schlüssel gehört zur **Schule**, nicht zum Tenant. Ein Schulträger-Tenant mit vielen
  Schulen hat darum viele Master-Keys.
- Die Lehrkräfte müssen wissen, dass die Schule entschlüsseln kann (Datenschutzerklärung,
  Onboarding).
- Einzelkunden haben keinen Master-Key.

### Grenzen

- Der Betreiber liefert den Code aus. Ein manipuliertes Update könnte Schlüssel abgreifen.
  Gegenmittel: Open Source, nachvollziehbare Builds.
- Der Server sieht Metadaten: Anzahl, Größe und Zeitpunkt der Einträge. Gegenmittel: zufällige
  UUIDs, Tabellenname im verschlüsselten Inhalt.

## 3. Synchronisierung

- Der Server speichert pro Eintrag: `id`, `userId`, `ciphertext`, `updatedAt`, `deleted`, `seq`
  (fortlaufend, vom Server), `deviceId`.
- **Online**: Ein WebSocket meldet neue `seq`. Die Geräte laden nach.
- **Offline**: Das Gerät merkt sich die letzte `seq`. Beim Verbinden lädt es alles danach und
  sendet seine Änderungen.
- **Löschen**: Markierung `deleted` (Tombstone), kein echtes Löschen. Sonst bringt ein
  Offline-Gerät den Eintrag zurück.
- **Zeitstempel**: Der Server setzt `updatedAt`. Geräteuhren sind unzuverlässig.
- **Fotos**: Einzeln verschlüsselt in einem Objektspeicher, nicht in der Datenbank.
- **Schema**: Jeder Eintrag enthält eine Schemaversion im verschlüsselten Inhalt.
- Der heutige Ablauf mit Route-Loadern und `useRevalidator` bleibt. Eine Änderung vom Server
  löst ein Neuladen aus.

## 4. Login und Kunden

### Anbieter

| Anbieter | Für wen | Merkmal für die Kundenprüfung |
|---|---|---|
| Microsoft Entra ID | Schulen und Schulträger mit M365 | `tid` (Tenant-ID), bei Bedarf Gruppe oder Domain pro Schule |
| VIDIS | Landeskonten (z. B. LOGINEO NRW, Schullogin) | Schulkennung |
| Google | Schulen mit Workspace for Education | `hd` (Domain) |
| Weitere (IServ, Landesplattformen) | später | Issuer-URL |
| Passkey, private Konten (Google, Microsoft, Apple) | Einzelkunden | eigene Lizenz |

Hinweise:

- Viele deutsche Schulen nutzen kein Microsoft 365. Microsoft allein reicht nicht.
- Microsoft: Multi-Tenant-App, Publisher-Verifizierung (kostenloses Partnerkonto). Viele
  Schul-Tenants brauchen eine Zustimmung der Schul-IT („Admin Consent“).
- VIDIS: Aufnahme als Angebot mit Datenschutzprüfung. Früh Kontakt zur FWU aufnehmen. Nicht jedes
  Land ist angebunden.
- Kein eigenes Passwortsystem. Der Server prüft nur ID-Tokens gegen die JWKS der Anbieter.

### Datenmodell

```
customers   id, type ('org' | 'person'), name, status, paidUntil
orgLogins   customerId, provider, orgId              -- nur bei 'org'
schools     id, customerId, name, publicMasterKey    -- eine Org kann viele Schulen haben
users       id, provider, subject, customerId?, schoolId?
keyWraps    userId, kind ('passkey' | 'recovery' | 'org'), credentialId?, wrappedKey
records     id, userId, ciphertext, updatedAt, deleted, seq
```

### Prüfung beim Login

1. Passen `provider` und `orgId` zu einem aktiven Org-Kunden? Dann ist der Zugang frei.
2. Sonst: Hat der User eine aktive eigene Lizenz? Dann ist der Zugang frei.
3. Sonst: Die App zeigt die Bezahlseite.

Wird die Schule einer Lehrkraft später Kunde, entfällt die eigene Lizenz.

## 5. Bezahlung

- **Org-Kunden**: Vertrag und Rechnung pro Schule oder Schulträger. `status` und `paidUntil`
  setzt Mario von Hand.
- **Einzelkunden**: Abo über einen Merchant of Record (Paddle oder Lemon Squeezy). Er führt
  die Umsatzsteuer ab und stellt die Rechnungen aus. Kosten etwa 5 % + 0,50 $ pro Zahlung.
  Alternative: Stripe ist günstiger, aber Umsatzsteuer und Rechnungen machst du dann selbst.
- Ein Webhook setzt `status` und `paidUntil`.
- Als PWA fällt keine Store-Provision an.

## 6. Recht und Datenschutz

- Noten von Minderjährigen sind besonders schützenswert.
- Die **Schule** ist verantwortlich. Der Betreiber ist **Auftragsverarbeiter**.
- **AVV** (Art. 28 DSGVO) mit jeder Schule bzw. jedem Schulträger. Bei Einzelkunden ein
  Standard-AVV zum Download.
- Verschlüsselte Daten gelten meist weiter als personenbezogen. E2EE senkt das Risiko, ersetzt
  die DSGVO-Pflichten aber nicht.
- Unterlagen für Schulen: TOM, Material für die Datenschutz-Folgenabschätzung, Löschkonzept,
  Meldeweg für Datenpannen.
- Private Geräte brauchen in vielen Ländern eine Genehmigung der Schulleitung. Im Onboarding
  darauf hinweisen.
- Einzelkunden sind Verbraucher: AGB, Widerrufsbelehrung, Preise inklusive Umsatzsteuer.
- Impressum und Datenschutzerklärung.
- Mit Einnahmen: Gewerbe anmelden, Kleinunternehmerregelung prüfen.
- Serverstandort EU. US-Anbieter erschweren die Gespräche mit Schulen.
- Nutzungsbedingungen von mehr-schulferien.de für den kommerziellen Einsatz prüfen.

## 7. Infrastruktur und Kosten

| Posten | Wahl | Kosten |
|---|---|---|
| Server | Hetzner (EU), kleinste ARM-VM: Node, SQLite oder Postgres, WebSocket | ca. 4–5 €/Monat |
| Objektspeicher (Fotos) | Hetzner Object Storage oder Speicher der VM | gering |
| Alternative für Tests | Cloudflare Workers, Durable Objects, D1, R2 (Jurisdiktion EU) | Free-Tier |
| Login | Microsoft, Google, Apple, Passkeys | 0 € |
| Domain | | ca. 10 €/Jahr |
| Hosting der PWA | Cloudflare Pages (wie heute) | 0 € |
| **Summe** | | **ca. 60–70 €/Jahr** plus Gebühren je Zahlung |

## 8. Roadmap

### Phase 1: Sync für den eigenen Gebrauch

- [ ] Server mit Tabelle `records`, Push/Pull nach `seq` und WebSocket.
- [ ] Datenschlüssel, Verschlüsselung pro Eintrag, Wiederherstellungsschlüssel mit
      Speicherdialog.
- [ ] Passkey mit PRF zum Wrappen. Auf dem Schul-iPad testen.
- [ ] Lokale SQLite als Cache, Neuladen bei Änderungen vom Server.
- [ ] Fotos verschlüsselt im Objektspeicher.
- [ ] Import der bestehenden lokalen Daten (heutige Sicherung als Quelle).
- [ ] Test mit zwei Geräten gleichzeitig.

### Phase 2: Konten und Einzelkunden

- [ ] Tabellen `customers`, `users`, `keyWraps`.
- [ ] Login mit Passkey und privaten Konten.
- [ ] Prüfung beim Login, Bezahlseite.
- [ ] Merchant of Record mit Webhook.
- [ ] Konto löschen in der App.
- [ ] AGB, Widerrufsbelehrung, Impressum, Datenschutzerklärung, Standard-AVV.

### Phase 3: Schulen über Microsoft

- [ ] Multi-Tenant-App in Entra ID, Publisher-Verifizierung.
- [ ] Tabellen `orgLogins` und `schools`, Zuordnung Lehrkraft → Schule.
- [ ] Master-Key: Erzeugen bei der Schule, Hinterlegen des öffentlichen Schlüssels, Werkzeug
      zum Entschlüsseln für die Administration.
- [ ] Unterlagen für Schulen: AVV, TOM, Material zur Folgenabschätzung.
- [ ] Erste Pilotschule.

### Phase 4: Weitere Anbieter

- [ ] VIDIS anbinden (Kontakt zur FWU, Datenschutzprüfung).
- [ ] Google Workspace for Education.
- [ ] Bei Bedarf IServ und Landesplattformen.

### Später

- [ ] Verträge mit Bundesländern.
- [ ] App Store (Capacitor). Vorher prüfen: SQLocal braucht OPFS und COOP/COEP, in der iOS-
      WebView wahrscheinlich ein natives SQLite-Plugin nötig. Apple verlangt Konto-Löschen in
      der App, Datenschutz-Labels und meist „Sign in with Apple“.

## 9. Offene Fragen

- Preis pro Lehrkraft und pro Schule.
- Wer betreut die Schlüssel-Zeremonie bei der Schule (Anleitung, Werkzeug)?
- Wie lange bleiben Daten nach Vertragsende erhalten?
- Open Source ja oder nein?
