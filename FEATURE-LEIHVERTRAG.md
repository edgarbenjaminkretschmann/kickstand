# Prompt: Leihvertrag-Generator als erstes Feature auf der Startseite

Kickstand is live at https://kickstand.deutschacademy.com: Cloudflare Workers + Turso + R2.

Up to now the contract wizard (`/app/loans/new`) only works after login and with a bike that's already entered. The **Leihvertrag-Generator** should become the first thing visitors see and can use: **without login**, for any motorcycle, any Verleiher and any Entleiher, with the PDF straight away.

Read first:
- `README.md`, `docs/DECISIONS.md`
- `src/pages/index.astro`
- `src/pages/app/loans/new.astro`
- `src/lib/contract-pdf.ts`, `src/lib/euro-words.ts`, `src/lib/dates.ts`
- `src/scripts/signature-pad.ts`, `src/scripts/photos.ts`, `src/scripts/pdf.ts`
- `reference/prompt-leihvertrag-formular.md`: the full form spec, the "lessons learned" section and the PDF layout
- `reference/leihvertrag-ausfuellen.md`: contract text and filling rules

Then make a short plan (which components you extract from the wizard and reuse) and build it.

## 1. New public page `/leihvertrag`
- Uses the **PublicLayout** (design A). No login needed.
- **Only in the browser:** with no login, nothing goes to the server. No DB, no upload, no logging of the form fields.
  - Draft in `localStorage`, texts and switches only, wrapped in try/catch.
  - Photos and signatures stay in memory only; say that on the page.
  - Short note at the top: "Deine Daten bleiben auf deinem Gerät, bis du dich anmeldest und speicherst."
- **Form** as in `reference/prompt-leihvertrag-formular.md`:
  - Verleiher, Entleiher
  - Motorrad (with the Fahrzeugschein field numbers, plus a switch for the Feld 22 footpeg condition)
  - Versicherung
  - Haftungsgrenze: 500 / 1.000 / 1.500 / other, with words generated automatically
  - Leihdauer: **Offen** with "spätestens am", or **Festes Ende**
  - Rückgabeort with buttons "= Adresse Entleiher" / "= Adresse Verleiher"
  - Mitgegeben
  - Übergabe with a dictation tip and photos
  - Rückgabe, collapsible
  - Ort, Datum and two signature pads
- **Date fields** use the existing text inputs (TT.MM.JJJJ, HH:MM), never `type="date"`.
- **Sticky bottom bar** with "Leeren" (tap twice to confirm) and **"PDF erstellen"**. On our own domain a normal download works: create a Blob and trigger it via `<a download>`. On iOS, if needed, open the PDF in a new tab.
- **One source for the PDF:** it comes from the same `buildContractPdf()` as the logged-in wizard. Refactor so both paths pass the same data object. Don't duplicate contract text.
- **Logged-in users** see an extra button "In meinem Konto speichern". It creates the bike (if new) and the loan as `active` through the existing data layer, uploads photos to R2, then redirects to `/app/loans/[id]`. Logged-out visitors see "Anmelden, um zu speichern" (the draft survives the login thanks to localStorage).
- **Language:**
  - The form is German; labels go through the existing i18n, like the other pages.
  - **The contract PDF always stays German**, because it's a contract under German law. Note this on the page for other languages.
- **Search:** a meta title and description for search ("Leihvertrag Motorrad kostenlos erstellen – mit Übergabeprotokoll, Fotos und Unterschrift am Handy").

## 2. Start page: the generator comes first
Keep design A (colors, fonts, oval logo, brush stroke, photos). Only change the order and the hero:
- **Hero:**
  - Headline: "Leihvertrag fürs Motorrad – in 5 Minuten am Handy."
  - Subline: "Kostenlos, ohne Anmeldung. Mit Übergabeprotokoll, Fotos und Unterschrift. Fertig als PDF."
  - Primary pill (black): **"Leihvertrag erstellen"** → `/leihvertrag`
  - Secondary pill (sky): "So geht's"
  - The rider photo in the sky oval stays.
- **Directly under the hero:** the existing contract section moves to second place:
  - `myanmar.jpg`, the § 6 snippet and three short check points: "Offen oder festes Ende", "Haftungsgrenze frei wählbar", "Fotos & Unterschrift"
  - a button "Jetzt Vertrag erstellen"
- **After that, unchanged:**
  - "So geht's" (3 steps)
  - the dark section "Garagen & Hilfe" with the 3 latest listings
  - the sky CTA band (button "Kostenlos mitmachen" → `/registrieren`)
  - footer
- **Header (PublicLayout):** add "Leihvertrag" as the first menu item, before "So geht's".
- No other new sections, no counters, no testimonials.

## 3. Tests and checks
- **Vitest:**
  - `buildContractPdf()` with made-up data, both open and fixed, with and without the footpeg clause: page count and that key text is present
  - `euroInWords()` for 500, 1000, 1500, 2500 and 750
  - the shared data mapper (form → PDF data)
- **Privacy check:** the page loads and creates a PDF **with no network requests except static assets** (check in the test or manually, and note it in DECISIONS).
- **Screenshots** of `/` and `/leihvertrag` at 390px and 1280px. Show me those before deploying.
- **Deploy and verify:** `npm run deploy`, then open https://kickstand.deutschacademy.com/leihvertrag on the phone and create a PDF.

Record decisions in `docs/DECISIONS.md` and update the README (new route, privacy note).
