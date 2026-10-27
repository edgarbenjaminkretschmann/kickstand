# Kickstand: Astro build prompt

Build **Kickstand** with Astro: a small community platform where riders lend each other motorcycles for free and help each other with garages, tools and workshop space. Mobile-first, German UI, bare bones. Keep it small enough that one person can run it on one VPS.

## Stack
- **Astro 5** with SSR (`output: "server"`) and the `@astrojs/node` adapter in standalone mode
- **Astro DB** (libSQL/SQLite file locally, a Turso URL in production via env) for all data
- **Astro Actions** for every form (zod validation), with progressive enhancement: forms must work without JS
- **Auth:** Better Auth with email + password, session cookie, middleware that puts `locals.user` on every request. No OAuth, no email verification for now.
- **Client JS:** vanilla `<script>` islands only, no React/Vue. Use them for the signature pad, photo resizing and the PDF.
- **PDF:** jsPDF in the browser
- **Photos:** uploaded through an Action, resized to max 1600px with `sharp`, stored under `./uploads` and served by an endpoint that checks access
- **Styling:** plain CSS with custom properties in one global file plus scoped component styles. No Tailwind.
- **Language:** UI text in German, code and comments in English
- **Deploy:** one Dockerfile and a `docker-compose.yml` with a volume for `uploads/` and the DB file

## Pages

### Public (no login)
- `/`: landing page. Short pitch, how it works in three steps (Motorrad eintragen → Leihvertrag am Handy → Übergabe mit Fotos & Unterschrift), plus the latest 6 board posts.
- `/so-gehts`: explains the free lending (Leihe nach §§ 598 ff. BGB), liability cap, insurance and the handover protocol. Plain text from a content collection (`src/content/pages/`).
- `/board`: Garagen & Hilfe list, filter by kind and city. Contact details are hidden until logged in.
- `/login`, `/register`

### Members (login required, guarded in middleware)
- **`/app`** (dashboard):
  - my bikes
  - active loans
  - open loan requests
  - my board posts
- **`/app/bikes/new`** and **`/app/bikes/[id]/edit`**: bike form laid out like the German Zulassungsbescheinigung Teil I. Fields:
  - make, model, type code (D.2), plate (A), VIN (E), first registration (B)
  - power kW (P.2), displacement ccm (P.1), fuel (P.3)
  - conditions (22), e.g. "Beifahrer nur mit Fußrasten"
  - insurer, policy number, default liability cap in € (e.g. 1.000), photo
  - a toggle "für Mitglieder ausleihbar"
- **`/bikes`**: members-only list of bikes marked as lendable (photo, model, city of owner, "Anfragen" button)
- **`/bikes/[id]`**: bike detail. Shows "verliehen" if there is an active loan. A request form takes desired start date and a message.
- **`/app/loans/new?bike=…&request=…`**: the contract wizard. It is one long mobile page with a sticky "PDF erstellen" button at the bottom. If it comes from a request, it is prefilled with the requester's profile.
  - **Borrower data.** The borrower does not need an account; the lender can type everything in.
  - **Duration:**
    - Segmented toggle **Offen** / **Festes Ende**
    - Open means "offen (unbefristet), spätestens am …" with a required latest date
    - Rückgabe auf Aufforderung innerhalb von 3 Tagen (§ 604 Abs. 3 BGB)
  - **Return place**
  - **Handed-over items:** keys (count), registration doc, free text
  - **Handover protocol:**
    - odometer, fuel level, damages textarea
    - a hint that the phone keyboard's mic can dictate
    - photo upload with `accept="image/*"` and multiple files
  - **Place and date**
  - **Signatures:** two signature pads (lender, borrower) on canvas with pointer events, `touch-action: none`, a white background and a "Löschen" button
  - **Saving:**
    - Save as `draft` on every change through an Action (debounced), so nothing is lost when the phone locks
    - "Vertrag abschließen" sets the loan `active`
- **`/app/loans/[id]`**: loan detail. Download PDF, start return.
- **`/app/loans/[id]/return`**: return protocol with date/time, odometer, fuel, new damages and photos. Saving sets the loan `returned`; the PDF then also has the return column filled.
- **`/app/board/new`**, **`/app/board/[id]/edit`**: board posts
- **`/app/profile`**: name, street, PLZ/Ort, phone, birth date, licence number, class A since. Used to prefill contracts.

## Data (Astro DB tables in `db/config.ts`)
- **User:** Better Auth's tables, plus a **Profile** table:
  - userId, name, street, zipCity, phone, birthdate, licenseNumber, licenseClassASince, city
- **Bike:**
  - id, ownerId, make, model, typeCode, plate, vin, firstRegistration, powerKw, displacementCcm, fuel, conditions
  - insurer, policyNumber, liabilityCapEur, photoPath, lendable, createdAt
- **LoanRequest:** id, bikeId, requesterId, desiredStart, message, status (`open` | `accepted` | `declined`), createdAt
- **Loan:**
  - id, bikeId, lenderId, requestId?, status (`draft` | `active` | `returned`)
  - borrower fields: borrowerName, borrowerStreet, borrowerZipCity, borrowerBirthdate, borrowerPhone, licenseNumber, licenseClassASince
  - startDate, startTime, endMode (`open` | `fixed`), endDate, latestEndDate, returnPlace, liabilityCapEur, handedOverItems (json), placeDate, createdAt
- **Protocol:** id, loanId, kind (`handover` | `return`), datetime, odometerKm, fuelLevel, damages
- **Photo:** id, protocolId, path, takenAt
- **Signature:** id, loanId, role (`lender` | `borrower`), pngDataUrl
- **BoardPost:** id, userId, kind (`garage` | `tools` | `help_offered` | `help_wanted`), title, body, city, contact, active, createdAt
- **Seed** (`db/seed.ts`), with obviously fake people:
  - one demo user
  - one bike: Honda VFR 750 F, RC36, VIN HMRC362400700, EZ 23.05.1995, 74 kW, 748 ccm, cap 1.000 €
  - two board posts

## Contract PDF
`reference/leihvertrag-reference.html` is the source of truth for wording, section order and layout. Its `buildPdf()` already produces a working German contract with jsPDF. Move it into `src/lib/contract-pdf.ts` as a pure function `buildContractPdf(data)` that takes a plain object (loan + bike + lender + protocols + photos + signatures), so the same code runs in the browser and in a test. Keep:
- **Parties:** separate tables for **Verleiher** and **Entleiher**, each with "Name, Vorname" and "Anschrift", with "und" between them
- **§ 1** bike data from the bike record, plus handed-over items
- **§ 2** duration text as above. Do **not** add a sentence that the borrower may return early.
- **§ 3–§ 5:**
  - fuel and fines are paid by the borrower
  - usage rules, plus the bike's `conditions` text if set
  - liability insurance with insurer and policy number. No Kasko section.
- **§ 6** cap per damage from `liability_cap_eur`:
  - written as number and German words, e.g. "1.000,00 € (in Worten: eintausend Euro)"
  - write a small `euroInWords()` helper with tests for 500, 1000, 1500 and 2500
  - full liability for intent, gross negligence, alcohol/drugs, riding without a licence, handing the bike to others, racing, hit-and-run
- **§ 7–§ 9** as in the reference
- **Signatures:** "Ort, Datum" lines with the signature images
- **Annex:** handover/return protocol table with signature images in the handover column
- **Photo pages:** "Fotodokumentation Übergabe" / "Rückgabe", 6 photos per A4 page, with photo number and time
- **Footer:** "Leihvertrag <Modell> · <Kennzeichen>" and "Seite x von y"

## Rules
- **Access:**
  - Owners see and edit only their own bikes, loans and requests.
  - Requesters see their own requests.
  - Photos and signatures are only served to the lender and to the requester linked to that loan.
- **One active loan per bike.** Accepting a request declines the other open ones for overlapping dates.
- **Dates:**
  - Store as ISO; show as DD.MM.YYYY everywhere, PDF included.
  - Do not trust the browser locale (Android in English shows MM/DD in date inputs).
- **Mobile UX:**
  - inputs at `font-size: 16px`, tap targets of at least 44px
  - the sticky bottom bar respects `env(safe-area-inset-bottom)`
- **Quality:**
  - Every page works and looks fine at 360px width.
  - Light and dark theme via `prefers-color-scheme`.
- **No paid services, no analytics, no external fonts required.** It may use one Google font, with a system fallback.

## Look
Calm, utilitarian, slightly workshop-like:
- off-white background, dark ink text
- one deep green accent taken from the pale green of the German Fahrzeugschein
- a monospace face for vehicle data (plate, VIN, km) so it reads like the document

No hero images, no gradients, no emoji.

## Deliverables
1. **Running app:** `npm run dev` works with the seed data.
2. **README:** setup, env vars (`ASTRO_DB_REMOTE_URL`, `ASTRO_DB_APP_TOKEN`, `BETTER_AUTH_SECRET`, `UPLOAD_DIR`), and Docker deploy.
3. **Tests (Vitest):**
   - `euroInWords()`
   - `buildContractPdf()` returns a PDF with at least 3 pages for the seed loan
   - date formatting helper

Start by reading `reference/leihvertrag-reference.html`. Then reply with the folder structure and the DB schema in a few lines, then build page by page in this order:
1. Auth and profile
2. Bikes
3. Loan wizard and PDF
4. Return
5. Requests
6. Board
7. Landing
