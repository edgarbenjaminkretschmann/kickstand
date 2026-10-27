# Decisions in Phase 2

Judgement calls made while building Phase 2 (`PROMPT-2.md`), so they can be revisited deliberately.

## Database

- **Drizzle on libSQL, no Astro DB.** `@astrojs/db` and the `overrides` pin are gone; `drizzle-orm` is a normal dependency shared with Better Auth's adapter.
- **Same table and column names as Phase 1** (`User`, `Bike`, `Loan`, ...). New marketplace tables use the lower-case names from the prompt (`listing`, `conversation`, ...). The mix is ugly but keeps old queries and the legacy migration simple.
- **Timestamps are integer epoch milliseconds** (`timestamp_ms` mode), calendar dates stay ISO `YYYY-MM-DD` strings as before. Both map cleanly to Postgres (`timestamptz`, `date`/`text`).
- **Defaults are set in JS (`$defaultFn`), not as SQL expressions**, so they behave identically on SQLite and Postgres.
- **Two extra columns on `listing`: `searchText` and `cityKey`.** Lower-cased in JS with `toLocaleLowerCase("de-DE")`. SQLite's `lower()` only folds ASCII, so "ÜBER" would not find "Überlingen"; matching pre-folded columns with plain `LIKE` works the same everywhere. Written on every create/update by the data layer. Indexes on `cityKey` and `userId` were added on top of the ones the prompt asked for.
- **Categories are reference data inserted by migration `0001_categories.sql`**, not only by the seed, so production has them without demo data. `src/db/categories.ts` holds the same list for code; both must be kept in sync.
- **`DATABASE_AUTH_TOKEN`** was added next to `DATABASE_URL` so Turso keeps working as in Phase 1.
- **The seed wipes all rows** and refuses to run with `NODE_ENV=production` unless `--force`.

## Data-access layer

- **Other people's listings, conversations and loans return NOT_FOUND, never FORBIDDEN**, so ids reveal nothing.
- **Access rules live in the data functions** (`getOwnListing`, `getConversationForUser`, `getLoanForUser`), not in pages. `src/lib/access.ts` just re-exports them.
- **Pages and actions import only `src/lib/data`, `src/lib/auth`, `src/lib/storage`.** Scripts (`seed`, `migrate-legacy`) and tests may use the schema directly.

## Auth

- **`User.name` is the public display name, `Profile.name` the full name for contracts.** Listings show only the first name plus "Mitglied seit".
- **A profile row is created for every new member** (email or Google) by a Better Auth `user.create` hook, prefilled with the display name.
- **First Google login lands on `/profil?willkommen=1`**; later logins go back to `next`.
- **Account linking:** a Google login with the same verified e-mail as an email + password account joins it (Google is a trusted provider).
- **Google button only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.** It is a form POST to an action that returns the Google URL, so it works without JS.
- **`/register` 301-redirects to `/registrieren`**, keeping the query string.
- **"Passwort vergessen" is a stub page**: there is no e-mail sending yet, so it points to Google login or contacting us.
- **Login rate limit:** 10 attempts per e-mail and 30 per IP in 10 minutes, in memory.

## Storage

- **`STORAGE_DRIVER=local|gcs`** (default `local`) and `GCS_BUCKET` select the adapter; `gcs` currently throws "not implemented".
- **Keys are relative POSIX paths** (`listings/<listingId>/<uuid>.jpg`); `LocalDiskStorage` refuses keys that escape `UPLOAD_DIR`.
- **All uploads are re-encoded as JPEG, max 1600 px**, EXIF rotation applied, metadata stripped (as in Phase 1).
- **Listing photos are public** at `/media/listing/<photoId>` with a long immutable cache (ids are random and change when a photo is replaced). Bike photos are owner-only; protocol photos and signatures only for lender and linked borrower.

## Listings

- **Bike listings** (`motorrad-leihen` + `biete`) must link one of the user's own bikes and are forced to `kostenlos`. A `suche` in that category needs no bike, and listings in other categories never keep a `bikeId`.
- **Price rules:** `preis` needs an amount; `vb` may have one ("120 € VB") or not ("VB"); `kostenlos` and `tausch` drop any amount. Upper limit 100.000 €.
- **Country:** `DE` by default; labels exist for DE, AT, CH, PT, ES. The place line shows the country only when it is not DE.
- **Inactive listings** (`reserviert`, `erledigt`) are left out of search but stay reachable by direct link (Merkliste, conversations) with a notice, so people see what happened.
- **"verliehen":** while the bike has an active loan, no *new* conversations can start. Existing conversations continue, so lender and borrower can still talk.
- **Delete** is a two-step page flow (`?loeschen=1` shows the confirm box, the second POST carries `confirm=ja`). It removes photos, saves and conversations; loans keep their data and lose only the listing link (`ON DELETE SET NULL`).
- **Merkliste** includes listings that are no longer active, marked with their status.
- **Search keyword:** every word (up to 6) must appear in title or description. Ort/PLZ is a prefix match on either the city or the zip.

## Conversations and messages

- **One conversation per listing and interested member** (unique index). Writing again from the listing reuses it.
- **Max 4000 characters per message.** Limit: 10 messages a minute, 120 an hour per member.
- **Polling:** the thread calls `/api/conversations/<id>/messages.json?after=<ms>` every 15 s, skips while the tab is hidden and polls once when it becomes visible again. The poll also marks incoming messages as read. Sending with JS happens in place; without JS it is a normal POST + redirect.
- **Unread counts** show in the header (desktop), as a badge on the Nachrichten tab, and as a dot on the avatar on phones.
- **`notifyNewMessage()`** is a stub that only logs in dev.

## Loans

- **Borrower access now comes from the conversation:** a loan's borrower is the buyer of its linked conversation. This replaces the Phase 1 "linked requester" rule.
- **Links are checked and fixed once:** a loan only links a listing that belongs to the lender and offers that bike, and a conversation of that lender about that listing. Once set, the links never change.
- **Prefill** from the other member's profile happens only for a new contract started from a conversation in which the current user is the seller.

## Route cleanup

- `/board` → `/anzeigen` with the old filter mapped (`garage` → `kategorie=garage`, `tools` → `werkzeug`, `help_offered`/`help_wanted` → `hilfe` + `typ=biete|suche`, `city` → `ort`).
- `/bikes` → `/anzeigen?kategorie=motorrad-leihen&typ=biete`; `/bikes/<id>` → that bike's listing if there is one, otherwise the same filter.
- `/app/board/*` → `/app`. All redirects are 301.

## Legacy migration (`scripts/migrate-legacy.ts`)

- **Deterministic ids** (`legacy_post_*`, `legacy_bike_*`, `legacy_conv_*`, `legacy_req_*`) plus `ON CONFLICT DO NOTHING`, so it can run twice safely. Members, bikes, loans and so on keep their ids.
- **Board posts:** the free-text `contact` field is **dropped**. Members now reach each other through Nachrichten, and the field often held phone numbers that should not be public. `active = false` becomes `erledigt`; prices become `kostenlos`.
- **Every lendable bike gets a bike listing**, so old `/bikes` links lead somewhere. Bikes that are not lendable but had requests get an `erledigt` listing, so the converted conversations have something to point at.
- **Loan requests become messages.** Body: "Leihanfrage ab TT.MM.JJJJ.", the original message, and the old status as text ("(Anfrage angenommen)"), since conversations have no status. Several requests from the same member for the same bike share one conversation. Migrated messages count as read.
- **Expired sessions are skipped**; valid ones are copied so people stay logged in.

## Design

- **Header follows the prompt, not the design export:** logo, "Suchen" (the prompt said "Anzeigen"; Edgar found it redundant next to "Anzeige aufgeben", and "Suchen" matches the mobile tab bar), black "Anzeige aufgeben" pill, Nachrichten with count, avatar menu or Anmelden. The landing page reaches "So geht's" and "Garagen & Hilfe" through its hero button and sections instead.
- **Landing "Garagen & Hilfe" cards** follow the design (chips, title, place) instead of reusing the photo cards from search, plus the price. The section shows the latest 6 active listings of any category; empty state with a button to post.
- **Landing CTAs:** "Motorrad eintragen" → `/app/bikes/new` (login first if needed); "Kostenlos mitmachen" → `/registrieren`, or "Anzeige aufgeben" when logged in.
- **Photos are pre-converted webp** in `public/images/` (`rider-640/1200`, `myanmar-640/1200`) with `srcset`, rather than Astro's `<Image>`, to keep the build free of image processing.
- **Phones:** the logo oval shrinks to 104×44 under 560 px; search results become rows with the photo on the left (a classifieds list); the bottom tab bar hides on pages with their own sticky bar (loan wizard, return).
- **`img { height: auto }` globally**, because width/height attributes otherwise turn into a fixed CSS height and break `aspect-ratio`.
- **Mr Dafoe only** in the logo, the "So geht's" step numbers and "Einfach losfahren."; Roboto Slab for headings and prices; Open Sans for everything else.

## "Edgar & seine Motorradreisen" (`/touren`)

- **The hero photo on `/` is a link** (photo, caption and an outline pill "Edgar & seine Motorradreisen") to `/touren`; the footer links there too.
- **Photos come from Edgar's "Motorcycle Tours" folder**, converted once to webp (640 and 1280 px) in `public/images/touren/`. Trips and years are taken only from the file names; photos without a place in the name are grouped as "Unterwegs" with no location.
- **Left out on purpose:** photos where other people are the subject (locals in India and Myanmar, a musician, children next to the bike, people on scooters), the four 347 px thumbnails, and a near-duplicate Alps shot. Publishing identifiable strangers, and children above all, needs their consent.
- **The intro text is a draft** for Edgar to adjust.

## Hosting on Cloudflare

- **Cloudflare Workers + Turso + R2**, chosen over Vercel, Railway and a VPS: Edgar already pays for Workers Paid and has the domain on Cloudflare. The Node build (dev, tests, Docker) keeps working unchanged.
- **Turso instead of D1** for now: the code already speaks libSQL, and D1 has no interactive transactions. D1 stays an option later.
- **One codebase, two builds.** `astro.config.cloudflare.mjs` reuses `astro.config.mjs` and swaps the adapter. Platform code is chosen by the `#platform` subpath import with a `workerd` condition, not by runtime checks, so sharp and `node:fs` never end up in the Worker bundle.
- **Cloudflare Images replaces sharp on Workers** (binding `IMAGES`, `fit: scale-down`, JPEG quality 82). Each upload is one unique transformation; at Kickstand's size that stays inside the free allowance. The browser already shrinks photos to 1600 px, so the binding mostly re-encodes and strips metadata.
- **R2 bucket is private.** Every photo still goes through `/media/*`, so the access rules stay in one place.
- **Astro's own session store is off** (`session.driver: "null"`); sessions live in the database through Better Auth. That avoids a KV namespace the app would never use.
- **`clientIp` prefers `cf-connecting-ip`**, which Cloudflare sets and clients cannot fake.
- **The seed still writes photos to disk**; `npm run r2:upload` copies them into R2. Simpler than teaching the seed about R2.

## Seed

- **13 listings** instead of "~12", so every category has at least one. Fixed join dates make "Mitglied seit" stable.
- The tour listing in PT uses `myanmar.jpg` as its cover; the VFR listing has no photo.
