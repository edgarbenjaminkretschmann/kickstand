# Prompt: interaktives Leihvertrag-Formular (Handy) als Claude-Artifact

**So benutzen:** In einem neuen Claude-Chat diese Datei **und** `leihvertrag-ausfuellen.md` (Vertragstext in Teil 3) anhängen und schreiben: „Bau mir das wie hier beschrieben.“

---

Bau mir ein **interaktives Formular als veröffentlichtes Artifact (HTML-Seite)**, mit dem ich am Handy einen Motorrad-Leihvertrag ausfülle, unterschreiben lasse und als PDF speichere. Es soll für **jedes Motorrad, jeden Verleiher und jeden Entleiher** funktionieren: keine fest eingebauten Personen- oder Fahrzeugdaten.

Der Vertragstext steht in `leihvertrag-ausfuellen.md`, Teil 3. Übernimm ihn **wörtlich**. Nur die `{{Platzhalter}}` werden aus dem Formular gefüllt, nach den Regeln in Teil 2 derselben Datei.

## Formular (eine lange Seite, mobil zuerst)
Die Abschnitte in dieser Reihenfolge, jeder als eigene Karte:

1. **Verleiher**
   - Name, Vorname
   - Straße + Nr.
   - PLZ, Ort
2. **Entleiher**
   - Name, Vorname
   - Straße + Nr.
   - PLZ, Ort
   - Geburtsdatum
   - Telefon
   - Führerschein-Nr.
   - Klasse A seit
3. **Motorrad**, mit den Feldern des Fahrzeugscheins in Klammern als Hilfe:
   - Marke/Modell (D.1/D.3)
   - Typ (D.2)
   - Kennzeichen (A)
   - FIN (E)
   - Erstzulassung (B)
   - kW (P.2)
   - ccm (P.1)
   - Kraftstoff (P.3)
   - Schalter „Auflage Beifahrer-Fußrasten (Feld 22)“
4. **Versicherung**
   - Versicherer
   - Versicherungsscheinnummer
5. **Haftungsgrenze**
   - Segment-Buttons 500 € / 1.000 € / 1.500 € / „anderer Betrag“ (Zahlenfeld)
   - Der Betrag in deutschen Worten wird automatisch erzeugt.
6. **Leihdauer**
   - Beginn: Datum + Uhrzeit
   - Segment-Schalter **„Offen“ / „Festes Ende“**
   - Bei „Offen“: Feld „spätestens am“ und ein Hinweistext „Rückgabe auf Aufforderung innerhalb von 3 Tagen“
   - Bei „Festes Ende“: Ende Datum + Uhrzeit
   - Rückgabeort, mit einem Button „= Adresse Entleiher“ und einem Button „= Adresse Verleiher“
7. **Mitgegeben**
   - Schlüssel (Häkchen + Anzahl)
   - Zulassungsbescheinigung Teil I (Häkchen)
   - Sonstiges
8. **Übergabe**
   - Kilometerstand
   - Tankstand
   - Vorhandene Schäden (Textfeld)
   - Hinweis: „Tipp: Mit der Mikrofon-Taste auf der Handy-Tastatur kannst du diktieren.“
   - Button **„+ Fotos aufnehmen oder hochladen“** (`accept="image/*" multiple`), Vorschaubilder mit ×
9. **Rückgabe** (einklappbar, „später ausfüllen“)
   - Datum, Uhrzeit
   - km
   - Tank
   - neue Schäden
   - Fotos
10. **Unterschriften**
    - Ort, Datum
    - zwei Unterschriftsfelder (Verleiher, Entleiher) auf `<canvas>` mit Pointer-Events, `touch-action: none`, weißem Hintergrund und je einem „Löschen“-Link

Unten eine **feste Leiste** (mit `env(safe-area-inset-bottom)`) mit „Leeren“ (Bestätigung durch zweites Tippen, kein `confirm()`) und **„PDF erstellen“**.

## Wichtige Details (haben wir schon falsch gemacht, bitte beachten)
- **Datumseingaben als Textfelder** mit `TT.MM.JJJJ` und Uhrzeit `HH:MM`, nicht `<input type="date">`. Grund: Auf einem englisch eingestellten Android-Handy zeigt `type="date"` MM/DD an, und dann werden Tag und Monat vertauscht. Prüfe das Format beim Tippen und zeig einen Fehler direkt am Feld.
- **Speichern geht nur über die `downloads`-Capability des Artifacts.** `window.print()`, `<a download>` und Blob-Links funktionieren im Artifact nicht.
  - Hol den Namespace **erst beim Klick** mit `await claude.use("downloads")` und warte bis zu ~10 s darauf, dass `window.claude` da ist. Nicht beim Laden prüfen und dann für immer `null` behalten.
  - Fehlercodes behandeln: `declined` → „Abgebrochen“; `rate_limited` → „kurz warten“.
- **Notlösung**, wenn Speichern nicht verfügbar ist: einen Button **„Daten kopieren“** zeigen, der alle Eingaben als lesbaren Text in die Zwischenablage kopiert. Damit kann ich sie in einen Chat einfügen. Wenn die Zwischenablage blockiert ist, den Text markiert in einem Textfeld anzeigen.
- **Entwurf** in `localStorage` speichern: alle Textfelder und Schalter, in try/catch. Fotos und Unterschriften nicht, und das auch im Formular sagen.
- **Fotos** im Browser verkleinern (max. 1400 px, JPEG 0.82, mit EXIF-Drehung über `createImageBitmap(file, {imageOrientation: "from-image"})`). Nur Bilder annehmen; Videos höflich ablehnen.

## PDF (jsPDF 2.5.1 von cdnjs, Helvetica)
- **A4, Ränder 20 mm.** Titel „Leihvertrag über ein Motorrad“, darunter in Grau „unentgeltliche Leihe gemäß §§ 598 ff. BGB“.
- **Parteien:** „Zwischen“, dann **Verleiher** als eigene fette Überschrift mit eigener Tabelle (Name, Vorname / Anschrift), dann „und“, dann **Entleiher** mit eigener Tabelle (Name, Vorname / Anschrift / Geburtsdatum / Telefon / Führerschein-Nr. / Klasse A seit).
- **Tabellen:** graue Label-Spalte (50 mm), Wert-Spalte (120 mm), dünne Rahmen. Lange Texte umbrechen; Seitenumbruch vor einer Zeile, die nicht mehr passt.
- **Inhalt:** §§ 1–9 nach der Vorlage, § 6 Abs. 2 fett.
- **Unterschriften:** Unterschriftsbilder über den Linien, darunter „Ort, Datum: …“, „{{Verleiher}} (Verleiher)“ und „Entleiher ({{Name}})“.
- **Anlage auf neuer Seite:** „Anlage: Übergabe- und Rückgabeprotokoll“ mit Tabelle Übergabe | Rückgabe. Die Unterschriftsbilder kommen in die Übergabe-Spalte.
- **Fotoseiten:** „Fotodokumentation Übergabe“ / „Rückgabe“ mit 6 Fotos pro Seite, darunter „Foto n · TT.MM.JJJJ, HH:MM Uhr“ (Zeit aus der Bilddatei).
- **Fußzeile** auf jeder Seite: „Leihvertrag {{Modell}} · {{Kennzeichen}}“ links, „Seite x von y“ rechts.
- **Dateiname:** `Leihvertrag_{{Modell}}_{{Nachname Entleiher}}_{{JJJJ-MM-TT}}.pdf`

## Design (Kickstand / Vlogato)
- **Farben:**
  - Akzent `#5BB8E8` (Vlogato-Blau)
  - Text `#121417`
  - Hintergrund weiß
  - Abschnitte auf `#EEF7FC`
  - Ränder `#DFE9EF`
- **Schriften (Google Fonts):**
  - `Roboto Slab` für Überschriften
  - `Open Sans` für den Rest
  - `Mr Dafoe` nur für das kleine Logo „Kickstand“ in einem blauen Oval oben
- **Bedienelemente:**
  - Pill-Buttons: „PDF erstellen“ schwarz, ausgewählte Segmente blau
  - Eingaben mit 16px Schrift (damit iOS nicht zoomt)
  - Tippflächen mindestens 44px
  - funktioniert ab 360px Breite
- Hell- und Dunkelmodus über CSS-Variablen.
- Kein Emoji, keine Verläufe.

## Prüfen, bevor du fertig bist
1. Mit erfundenen Daten ein PDF erzeugen und kontrollieren:
   - Seitenzahl stimmt
   - Umlaute und das €-Zeichen sind richtig
   - offen/fest funktioniert
   - die Fußrasten-Klausel ist ein- und ausschaltbar
   - der Betrag in Worten stimmt (500, 1000, 1500, 2500)
2. Die Seite bei 390px Breite ansehen.
3. Mir in 2–3 Sätzen sagen, was du getestet hast und was nur am echten Handy prüfbar ist (Speichern-Dialog, Kamera).
