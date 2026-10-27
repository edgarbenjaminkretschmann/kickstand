# Leihvertrag Motorrad – zum Ausfüllen mit Claude

**So geht's:** Fülle das Datenblatt in Teil 1 aus (alles hinter dem Doppelpunkt). Kopiere dann diese ganze Datei in einen neuen Claude-Chat und schreib dazu: „Mach mir daraus den fertigen Vertrag als PDF.“ Fotos vom Fahrzeugschein oder Führerschein kannst du mitschicken; dann kann Claude die Felder auch selbst ablesen.

---

## Teil 1 – Datenblatt (ausfüllen)

### Verleiher
- Name, Vorname:
- Straße, Hausnummer:
- PLZ, Ort:

### Entleiher
- Name, Vorname:
- Straße, Hausnummer:
- PLZ, Ort:
- Geburtsdatum (TT.MM.JJJJ):
- Telefon:
- Führerschein-Nr.:
- Klasse A seit (Jahr):

### Motorrad (aus dem Fahrzeugschein / Zulassungsbescheinigung Teil I)
- Marke und Modell (Feld D.1 / D.3):
- Typ (Feld D.2):
- Amtliches Kennzeichen (Feld A):
- Fahrzeug-Ident.-Nr. / FIN (Feld E):
- Erstzulassung (Feld B, TT.MM.JJJJ):
- Leistung in kW (Feld P.2):
- Hubraum in ccm (Feld P.1):
- Kraftstoff (Feld P.3):
- Auflage in Feld 22 (z. B. Beifahrer nur mit Fußrasten) – sonst „keine“:

### Versicherung
- Versicherer (Haftpflicht):
- Versicherungsscheinnummer:

### Leihe
- Haftungsgrenze pro Schaden in € (z. B. 1000 oder 1500):
- Beginn (TT.MM.JJJJ, Uhrzeit optional):
- Dauer: „offen“ oder „fest“
- Bei „offen“: spätestens zurück am (TT.MM.JJJJ):
- Bei „fest“: Ende am (TT.MM.JJJJ, Uhrzeit):
- Rückgabeort:
- Schlüssel (Anzahl):
- Zulassungsbescheinigung Teil I mitgegeben (ja/nein):
- Sonstiges mitgegeben (z. B. Helm, Handschuhe):

### Übergabe
- Kilometerstand:
- Tankstand:
- Vorhandene Schäden (oder „keine“):

### Unterschrift
- Ort:
- Datum (TT.MM.JJJJ):

---

## Teil 2 – Anweisungen für Claude

1. Erstelle den Vertrag aus Teil 3 mit den Daten aus Teil 1. Ändere **keinen** Vertragstext außer den `{{Platzhaltern}}` und den unten genannten Regeln.
2. **Pflichtfelder:**
   - Verleiher: Name und Adresse
   - Entleiher: Name und Adresse
   - Motorrad: Marke/Modell, Kennzeichen, FIN
   - Versicherung: Versicherer und Nummer
   - Leihe: Haftungsgrenze, Beginn, Dauer

   Fehlt etwas davon, frag einmal gesammelt nach. Leere optionale Felder bleiben im Vertrag als Linie `__________` zum Ausfüllen per Hand.
3. **Daten:**
   - Datum immer als TT.MM.JJJJ.
   - Ein Datum wie 08/04/1981 aus einer englischen Handy-Ansicht ist Monat/Tag. Im Zweifel nachfragen.
4. **Haftungsgrenze:** als Betrag mit zwei Nachkommastellen und Tausenderpunkt (z. B. 1.500,00 €) **und** in deutschen Worten, klein geschrieben (z. B. „eintausendfünfhundert“).
5. **Dauer:**
   - Bei „offen“: Tabelle „offen (unbefristet), spätestens am {{spätestens}}“ und den Absatz „Die Leihe ist unbefristet …“ übernehmen.
   - Bei „fest“: Tabelle „{{Ende}}“ und diesen Absatz weglassen.
   - **Nicht** einfügen, dass der Entleiher früher zurückgeben darf.
6. **§ 4 Abs. 3:** den Satz zum Beifahrer nur übernehmen, wenn in Feld 22 eine solche Auflage steht.
7. **Weglassen:** keinen Kasko-Abschnitt einfügen.
8. **Ausgabe:** ein sauberes A4-PDF mit
   - Titel und Untertitel
   - Verleiher und Entleiher in **getrennten** Tabellen mit „und“ dazwischen
   - Fußzeile „Leihvertrag {{Modell}} · {{Kennzeichen}}“ und „Seite x von y“
   - Anlage (Protokoll) auf eigener Seite
   - Unterschriftslinien leer lassen

   Zusätzlich auf Wunsch als Markdown.

---

## Teil 3 – Vertragstext (Vorlage)

# Leihvertrag über ein Motorrad
*unentgeltliche Leihe gemäß §§ 598 ff. BGB*

Zwischen

**Verleiher**

| | |
|---|---|
| Name, Vorname | {{Verleiher Name, Vorname}} |
| Anschrift | {{Verleiher Straße}}, {{Verleiher PLZ Ort}} |

und

**Entleiher**

| | |
|---|---|
| Name, Vorname | {{Entleiher Name, Vorname}} |
| Anschrift | {{Entleiher Straße}}, {{Entleiher PLZ Ort}} |
| Geburtsdatum | {{Geburtsdatum}} |
| Telefon | {{Telefon}} |
| Führerschein-Nr. | {{Führerschein-Nr.}} |
| Klasse A seit | {{Klasse A seit}} |

wird folgender Leihvertrag geschlossen:

## § 1 Leihgegenstand

| | |
|---|---|
| Fahrzeug | {{Marke Modell}} (Typ {{Typ}}), Kraftrad |
| Amtl. Kennzeichen | {{Kennzeichen}} |
| Fahrzeug-Ident.-Nr. | {{FIN}} |
| Erstzulassung | {{Erstzulassung}} |
| Leistung / Hubraum | {{kW}} kW / {{ccm}} ccm, {{Kraftstoff}} |
| Mitgegeben | Fahrzeugschlüssel (Anzahl: {{Schlüssel}}); {{Zulassungsbescheinigung Teil I, falls ja}}; {{Sonstiges}} |

## § 2 Leihdauer und Rückgabe

| | |
|---|---|
| Beginn der Leihe | {{Beginn}} |
| Ende / Rückgabe | {{offen: „offen (unbefristet), spätestens am …“ / fest: Ende}} |
| Rückgabeort | {{Rückgabeort}} |

{{Nur bei „offen“:}} Die Leihe ist unbefristet. Der Verleiher kann das Motorrad jederzeit zurückfordern (§ 604 Abs. 3 BGB); der Entleiher gibt es dann innerhalb von 3 Tagen nach Aufforderung zurück. Die Leihe endet in jedem Fall spätestens am {{spätestens}}.

Der Entleiher gibt das Motorrad pünktlich, sauber und mit gleichem Tankstand am vereinbarten Rückgabeort zurück. Eine Verlängerung bedarf der Zustimmung des Verleihers.

## § 3 Unentgeltlichkeit und Kosten
Die Überlassung erfolgt unentgeltlich. Kraftstoff während der Leihzeit trägt der Entleiher. Bußgelder, Verwarnungsgelder, Maut-, Park- und Abschleppkosten, die während der Leihzeit entstehen, trägt der Entleiher in voller Höhe; dies fällt nicht unter die Haftungsbegrenzung nach § 6.

## § 4 Nutzung
(1) Das Motorrad darf ausschließlich vom Entleiher gefahren werden. Er versichert, eine gültige Fahrerlaubnis der Klasse A zu besitzen, und legt diese bei Übergabe vor. Eine Weitergabe an Dritte ist nicht gestattet.

(2) Fahrten unter Einfluss von Alkohol, Drogen oder fahrtüchtigkeitsbeeinträchtigenden Medikamenten sind untersagt, ebenso Rennen, Fahrten auf Rennstrecken, Fahrsicherheitstrainings und Fahrten abseits befestigter Straßen.

(3) {{Nur bei Auflage in Feld 22: „Ein Beifahrer darf nur mitgenommen werden, wenn die vorgesehenen Fußrasten angebracht sind (Auflage laut Zulassungsbescheinigung).“}} Fahrten ins Ausland nur nach vorheriger Zustimmung des Verleihers.

(4) Der Entleiher behandelt das Motorrad pfleglich, sichert es beim Abstellen mit dem Lenkschloss und beachtet die Straßenverkehrsordnung.

## § 5 Versicherung
Das Motorrad ist bei der {{Versicherer}} haftpflichtversichert, Versicherungsscheinnummer {{Versicherungsscheinnummer}}. Die Haftpflichtversicherung deckt Schäden, die Dritten zugefügt werden. Schäden am geliehenen Motorrad selbst sind dadurch nicht abgedeckt.

## § 6 Haftung des Entleihers
(1) Der Entleiher haftet für alle Schäden am Motorrad sowie für dessen Verlust (auch Diebstahl), die während der Leihzeit entstehen und die er zu vertreten hat, z. B. bei einem Sturz oder Unfall.

**(2) Die Haftung nach Absatz 1 ist auf höchstens {{Betrag}} € (in Worten: {{Betrag in Worten}} Euro) je Schadensfall begrenzt.**
Ist der Schaden geringer, zahlt der Entleiher nur den tatsächlichen Schaden (Reparaturkosten laut Rechnung oder Kostenvoranschlag einer Fachwerkstatt). Ein Nachteil durch Höherstufung des Schadenfreiheitsrabatts wird ebenfalls auf den Höchstbetrag angerechnet.

(3) Die Begrenzung nach Absatz 2 gilt nicht, und der Entleiher haftet in voller Höhe, wenn der Schaden vorsätzlich oder grob fahrlässig verursacht wurde, insbesondere bei Fahrten unter Alkohol- oder Drogeneinfluss, ohne gültige Fahrerlaubnis, bei Überlassung an Dritte, bei Rennen oder Unfallflucht.

(4) Für normale Abnutzung bei vertragsgemäßem Gebrauch (§ 602 BGB) haftet der Entleiher nicht.

(5) Der Betrag ist innerhalb von 30 Tagen nach Vorlage der Rechnung bzw. des Kostenvoranschlags zu zahlen.

## § 7 Verhalten bei Unfall, Panne oder Diebstahl
Der Entleiher informiert den Verleiher unverzüglich. Bei Unfällen mit Fremdbeteiligung sowie bei Diebstahl ist die Polizei hinzuzuziehen. Der Entleiher gibt kein Schuldanerkenntnis ab, sichert Namen und Anschriften der Beteiligten und Zeugen und fertigt Fotos an. Reparaturen dürfen nur mit Zustimmung des Verleihers beauftragt werden.

## § 8 Haftung des Verleihers
Der Verleiher haftet nur für Vorsatz und grobe Fahrlässigkeit (§ 599 BGB). Ihm bekannte Mängel teilt er bei Übergabe mit (siehe Anlage: Übergabe- und Rückgabeprotokoll).

## § 9 Schlussbestimmungen
Änderungen und Ergänzungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung tritt eine Regelung, die ihrem wirtschaftlichen Zweck am nächsten kommt. Jede Partei erhält eine Ausfertigung dieses Vertrags.

| | |
|---|---|
| Ort, Datum: {{Ort}}, {{Datum}} | Ort, Datum: {{Ort}}, {{Datum}} |
| <br><br>______________________________ | <br><br>______________________________ |
| {{Verleiher Vorname Nachname}} (Verleiher) | Entleiher ({{Entleiher Name, Vorname}}) |

---

# Anlage: Übergabe- und Rückgabeprotokoll
*{{Marke Modell}} · {{Kennzeichen}} · FIN {{FIN}}*

| | Übergabe | Rückgabe |
|---|---|---|
| Datum / Uhrzeit | {{Beginn}} | |
| Kilometerstand | {{Kilometerstand}} km | |
| Tankstand | {{Tankstand}} | |
| Vorhandene / neue Schäden | {{Schäden}} | |
| Unterschrift Verleiher | | |
| Unterschrift Entleiher | | |

Mit der Unterschrift im Protokoll bestätigen beide Parteien den festgehaltenen Zustand des Motorrads bei Übergabe bzw. Rückgabe.

---

## Anhang – ausgefülltes Beispiel (fiktive Daten, nur zur Orientierung)

- **Verleiher:** Hoffmann, Jana · Kastanienallee 12 · 10435 Berlin
- **Entleiher:** Brandt, Lukas · Lindenstraße 7 · 50674 Köln · geb. 14.03.1990 · 0170 1234567 · FS-Nr. K0123456789 · Klasse A seit 2012
- **Motorrad:** Yamaha XT 660 R · Typ DM01 · K-LB 660 · FIN JYADM010000123456 · EZ 14.04.2008 · 35 kW · 660 ccm · Benzin · Feld 22: keine
- **Versicherung:** Musterversicherung AG · MV-2026-004711
- **Leihe:**
  - 1500 €
  - Beginn 01.11.2026, 10:00 · fest bis 15.11.2026, 18:00
  - Rückgabe Kastanienallee 12, 10435 Berlin
  - 2 Schlüssel · Zulassungsbescheinigung ja · Topcase, Kettenspray
- **Übergabe:** 48230 km · Tank voll · Kratzer am Tank links, Blinkerglas hinten rechts gerissen
- **Unterschrift:** Berlin, 01.11.2026
