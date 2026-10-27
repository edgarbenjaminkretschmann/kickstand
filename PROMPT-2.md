# Kickstand: Phase 2 – Marktplatz, Google-Login, Design A

This repo already contains a working first build from `PROMPT.md`:
- Astro 5 SSR with Astro DB and Better Auth (email + password)
- bikes, loan requests, loan wizard, return protocol, contract PDF, a simple board
- the current look is "IBM Plex / Werkstatt"

Phase 2 turns it into a small **marketplace platform for motorcyclists**. It follows the *principle* of Kleinanzeigen, not its design: people post what they **offer** (*Biete*) and what they're **looking for** (*Suche*):
- a motorcycle to borrow
- a garage spot
- tools
- parts
- help with a repair
- a tour partner

Lending a motorcycle still ends in the Leihvertrag with protocol, photos, signatures and PDF.

Later the whole backend (auth, database, file storage) moves to **Google** (Firebase or Google Cloud, not decided). Phase 2 prepares for that with a thin, swappable data/auth/storage layer. The move itself happens later.

**Before you change anything:**
1. Read `README.md`, `db/config.ts`, `src/middleware.ts`, `src/lib/auth.ts` and `src/actions/index.ts` to see what exists.
2. Read the new references:
   - `reference/design-a.html`: the chosen design, "A · Vlogato-Familie". It is a design-canvas export: ignore `<x-dc>`, `<helmet>`, `{{accent}}` (= `#5BB8E8`) and the script block; use the markup and inline styles as the visual spec.
   - `reference/brand/`: `rider.jpg` (Edgar with his bike in the Philippines), `myanmar.jpg` (Enduro on its kickstand), `vlogato-logo.png` (the original Vlogato logo, for reference only)
3. Reply with a short plan: what you keep, what you replace, what you migrate, and the new schema. Then work through the build order. Run `npm test` and `npm run check` after each step.

Keep everything that works: the loan wizard, return, `contract-pdf.ts`, `euro-words.ts`, `dates.ts`, the access rules, draft autosave, no-JS forms, and the text date inputs (TT.MM.JJJJ).

---

## 1. Database: leave Astro DB, go to Drizzle directly
The README notes that `@astrojs/db` is deprecated, and we move to Google later anyway. So:
- **Switch to Drizzle** with `drizzle-orm` + `@libsql/client` (SQLite file locally via `DATABASE_URL=file:./data/kickstand.db`) and `drizzle-kit` for migrations (`npm run db:generate`, `npm run db:migrate`, `npm run db:seed`).
- **Port the schema** from `db/config.ts` to `src/db/schema.ts`. Keep table and column names so existing logic still fits. Write it Postgres-portable:
  - text IDs
  - ISO strings / integer timestamps
  - no SQLite-only features
- **Better Auth** uses the drizzle adapter on the same DB.
- **Data-access layer.** All DB access goes through `src/lib/data/*.ts`:
  - `listings.ts`, `conversations.ts`, `bikes.ts`, `loans.ts`, `profiles.ts`, `saved.ts`
  - Each exports plain async functions with plain return types.
  - Actions and pages must not import Drizzle or the schema directly. Refactor the existing actions to use this layer.
- **Remove** `@astrojs/db` and the drizzle `overrides` hack.
- **Update** the Dockerfile and compose file (run migrations on start instead of `astro db push`).

## 2. Auth: add Google login
- Better Auth with **Google OAuth** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) in addition to email + password.
- If the Google vars are empty, hide the Google button and don't crash.
- **`/login` and `/registrieren`** (rename `register` → `registrieren` and keep a redirect):
  - "Mit Google anmelden" button on top
  - "oder mit E-Mail" form below
  - "Passwort vergessen" as a stub page
- **First Google login** creates the profile with the display name from Google. The user fills in the private contract fields (full name, address, birth date, licence) later in `/profil`.
- **Single entry point.** All auth calls go through `src/lib/auth/index.ts` (`getUser`, `requireUser`, sign-in/out helpers). Pages and actions never import Better Auth directly.
- **README:** how to create the OAuth client in Google Cloud Console, with redirect URI `http://localhost:4321/api/auth/callback/google` (plus the production URL).

## 3. Storage layer
- Wrap `src/lib/uploads.ts` in `src/lib/storage/index.ts` with a `StorageAdapter` interface: `save(buffer, opts) → key`, `read(key)`, `delete(key)`.
- Implement `LocalDiskStorage` (current behaviour, `UPLOAD_DIR`).
- Add a `GoogleCloudStorage` class that throws "not implemented" for now.
- Listing photos are public. Loan photos and signatures stay access-checked.

## 4. Marketplace: Anzeigen
Replace **BoardPost** and **LoanRequest** with listings + conversations. Write a one-off migration script that converts existing board posts and loan requests into listings/conversations. Demo data is fine to just reseed.

**Tables**
- **`category`** (slug, label, sort), seeded:
  - `motorrad-leihen` (Motorrad zum Leihen)
  - `garage` (Garage / Stellplatz)
  - `werkzeug` (Werkzeug)
  - `teile` (Teile & Zubehör)
  - `hilfe` (Hilfe beim Schrauben)
  - `tour` (Mitfahrer / gemeinsame Tour)
  - `sonstiges` (Sonstiges)
- **`listing`**:
  - id, userId, type (`biete` | `suche`), categorySlug, title, description
  - priceKind (`kostenlos` | `tausch` | `preis` | `vb`), priceCents?
  - zip, city, country (default `DE`; people also travel in PT and ES)
  - status (`aktiv` | `reserviert` | `erledigt`), bikeId?, createdAt, updatedAt
- **`listing_photo`** (id, listingId, key, sort): up to 8 photos, the first is the cover
- **`saved_listing`** (userId, listingId, createdAt): the Merkliste
- **`conversation`** (id, listingId, buyerId, sellerId, createdAt, lastMessageAt): one per listing + interested user
- **`message`** (id, conversationId, senderId, body, createdAt, readAt?)
- **Indexes:**
  - `listing(status, createdAt)`
  - `listing(categorySlug)`
  - `listing(city)`
  - `message(conversationId, createdAt)`

**Rules**
- **Bike listings:** a listing in `motorrad-leihen` with type `biete` must link to one of the user's bikes. Its price is always `kostenlos` (free Leihe).
- **"verliehen":** while the bike has an active loan, the listing shows the badge "verliehen" and can't be requested.
- **Starting a contract:** the owner can press **"Leihvertrag starten"** from that listing or from a conversation about it. It opens the existing loan wizard (`/app/loans/new?bike=…&listing=…&conversation=…`), prefilled from the other user's profile. Add `listingId?` and `conversationId?` to `loan`. The borrower may also have no account, as now.
- **Status:**
  - only `aktiv` listings show in search
  - the owner can set `reserviert` / `erledigt`
  - delete needs an in-page confirm (no `confirm()`)

**Pages**
- **`/anzeigen`** (search):
  - Filters: keyword (title + description), Alle / Biete / Suche, category, Ort/PLZ prefix
  - Sort: newest first, 20 per page
  - Cards show cover photo, type chip, category, title, price label, Ort and relative date ("vor 2 Tagen")
  - Logged-out visitors can browse
- **`/anzeigen/[id]`**:
  - Gallery, all details, seller first name + "Mitglied seit"
  - "Merken" heart
  - "Nachricht schreiben" (login required)
  - Owner sees Bearbeiten / Status / Löschen
- **`/anzeigen/neu`** and **`/anzeigen/[id]/bearbeiten`**:
  - Step 1: choose Biete/Suche + category
  - Step 2: the form, with photo upload (client-side shrink as in `src/scripts/photos.ts`)
- **Messages:**
  - `/nachrichten`: list with unread markers
  - `/nachrichten/[id]`: thread with reply box, plus a 15s poll while the thread is open
  - No websockets, no email. Add a `notifyNewMessage()` stub.
- **`/merkliste`**: saved listings
- **`/app`** (Mein Bereich):
  - meine Anzeigen
  - meine Motorräder
  - aktive Leihen
  - Nachrichten
  - Merkliste
- **Route cleanup:**
  - Remove `/board`, `/bikes` and the request actions; redirect the old URLs to `/anzeigen` with the matching filter
  - Keep `/app/bikes/*` and `/app/loans/*`
- **Rate limits:** a simple in-memory limit on login and on sending messages.

## 5. Design A "Vlogato-Familie" across the whole app
Kickstand is a sister project of Edgar's motorcycle travel blog vlogato.com. Restyle `global.css`, `Base.astro` and all pages to match `reference/design-a.html`, and remove the IBM Plex look.

- **Tokens (CSS variables):**
  - `--sky: #5BB8E8`
  - `--sky-wash: #EEF7FC`
  - `--ink: #121417`
  - `--text-2: #36404A`
  - `--muted: #4A5560`
  - `--line: #DFE9EF`
  - `--suche: #F2B134` (Suche / Hilfe gesucht chips)
  - Light theme only for now, but everything goes through variables.
- **Fonts (Google Fonts):**
  - `Mr Dafoe`: only the logo wordmark, step numbers and the one closing line
  - `Roboto Slab` 500/700: headings
  - `Open Sans` 400/600: body and UI
- **Logo:** "Kickstand" in Mr Dafoe inside a sky-blue oval (~132×56, `border-radius: 50%`), with small text "ein Projekt von Vlogato" next to it. Make it a component, `Logo.astro`.
- **Header:**
  - logo, "Anzeigen", a black pill "Anzeige aufgeben"
  - "Nachrichten" with an unread count
  - avatar menu or "Anmelden"
- **Mobile:** a bottom tab bar with Suchen, Merkliste, Aufgeben, Nachrichten, Mein Bereich (respect `env(safe-area-inset-bottom)`). The loan wizard keeps its sticky action bar and hides the tab bar.
- **Elements:**
  - pill buttons (black primary, sky secondary)
  - white cards with radius 14–16px and no heavy shadows
  - type chips: Biete = sky, Suche = `--suche`
- **Landing page `/`:** exactly like design A:
  - hero with the brush-stroke SVG and `rider.jpg` in the sky oval
  - "So geht's" with 3 steps
  - contract section with `myanmar.jpg` and the § 6 snippet
  - dark "Garagen & Hilfe" section showing the **latest 6 real active listings**, with an empty state if there are none
  - sky CTA band "Einfach losfahren."
  - footer "Kickstand · ein Projekt von Vlogato · Edgar Kretschmann" with Impressum/Datenschutz stubs
- **Copy photos:** put `reference/brand/*.jpg` into `public/images/` as optimized webp, using Astro's `<Image>` or pre-converted.
- **Quality:**
  - no emoji, no gradients
  - everything works at 360px
  - tap targets at least 44px
  - inputs at 16px font size

## 6. Seed (`npm run db:seed`, clearly fake)
- **Users:** keep the two demo users (`demo@kickstand.test`, `max@kickstand.test` / `kickstand-demo`)
- **Bike and loan:** the Honda VFR 750 F bike and the returned demo loan
- **Listings:** ~12 across all categories, both Biete and Suche, places in DE and PT. One of them is the VFR as `motorrad-leihen` / `biete`. Use `myanmar.jpg` on one listing.
- **Conversation:** 1 conversation with 3 messages about the VFR listing
- **Saved:** 2 saved listings for demo

## 7. Docs and tests
- **`docs/MIGRATION-GOOGLE.md`:** a short checklist for the later move. Cover:
  - (a) Firebase Auth + Firestore + Cloud Storage
  - (b) Better Auth + Cloud SQL Postgres + Cloud Storage

  Name exactly which files in `src/lib/data`, `src/lib/auth` and `src/lib/storage` change and what stays.
- **`docs/DECISIONS.md`:** every judgement call you make in this phase
- **README:** update setup, env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`/`SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPLOAD_DIR`), the Google OAuth setup and Docker.
- **Tests:**
  - Keep the existing tests passing.
  - New: listing search filter (type + category + keyword + Ort)
  - New: "only owner can edit listing"
  - New: conversation access (only buyer and seller)
  - New: a bike listing can't be created without a bike of your own

## Build order
1. DB switch to Drizzle + data layer. All existing features still work, tests green.
2. Auth: Google + email, `/login` and `/registrieren`, profile fields
3. Storage layer
4. Listings: create/edit/photos, search, detail, Merkliste
5. Conversations and messages, then "Leihvertrag starten" from a listing/conversation
6. Remove board and requests, redirects, data migration script
7. Design A everywhere, then the landing page
8. Seed, docs, tests

**Check-in:** after step 4 and after step 7, stop and show me screenshots of `/`, `/anzeigen` and `/anzeigen/[id]` at 390px and 1280px width.

Ask me only if something truly blocks you.
