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

## Design (design A, replaced in November 2026, see the redesign section below)

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
- **One codebase, two builds.** One `astro.config.mjs`; Cloudflare by default, `KICKSTAND_TARGET=node` for Docker. Platform code is chosen by the `#platform` subpath import with a `workerd` condition, not by runtime checks, so sharp and `node:fs` never end up in the Worker bundle.
- **Cloudflare Images replaces sharp on Workers** (binding `IMAGES`, `fit: scale-down`, JPEG quality 82). Each upload is one unique transformation; at Kickstand's size that stays inside the free allowance. The browser already shrinks photos to 1600 px, so the binding mostly handles photos posted without JS. It rotates them upright but **keeps EXIF, GPS included** (found in the second pass, see below), so metadata is stripped afterwards.
- **R2 bucket is private.** Every photo still goes through `/media/*`, so the access rules stay in one place.
- **Astro's own session store is off** (`session.driver: "null"`); sessions live in the database through Better Auth. That avoids a KV namespace the app would never use.
- **`clientIp` prefers `cf-connecting-ip`**, which Cloudflare sets and clients cannot fake.
- **The seed still writes photos to disk**; `npm run r2:upload` copies them into R2. Simpler than teaching the seed about R2.

## Cloudflare, second pass (`DEPLOY-CLOUDFLARE.md`)

The prompt assumed a move from Vercel. Kickstand was already live on Workers, so Edgar chose to fill the gaps and keep what worked:

- **Kept on purpose, unlike the prompt:** one private bucket `kickstand-photos` instead of `kickstand-public` + `kickstand-private` (every photo already goes through the access-checked `/media/*`; no public r2.dev URL exists at all); the Cloudflare Images binding instead of a pure-JS-only pipeline (it resizes, which pure JS in Workers cannot do cheaply); the env names `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SITE_URL` instead of `TURSO_*` / `PUBLIC_SITE_URL` (renaming would only have meant resetting the Worker secrets). The Turso URL in the prompt (`kickstand-edstar3000`) was wrong; the live one is `kickstand-kickstand` (org `kickstand`).
- **Public listing photos get a long cache** (`public, max-age=604800, immutable`) through the Worker instead of an r2.dev URL. `PUBLIC_MEDIA_URL` was therefore not added. A `media.<domain>` bucket URL stays possible later.
- **EXIF/GPS stripping in plain JS** (`stripJpegMetadata` in `src/lib/uploads.ts`), after the Images binding: walks the JPEG segments and drops APP1 (EXIF, XMP), APP3–APP13, APP15 and comments, keeps JFIF, the ICC profile and Adobe. No re-encode, no library, about 40 lines. The binding already rotated the pixels, so losing the orientation tag is safe. Verified on production with a GPS-tagged JPEG and a rotated one.
- **Uploads are checked by their first bytes** (JPEG, PNG, WebP), not by the browser's Content-Type. Errors are an `UploadError` with a German form message instead of a 500.
- **`imageService: "passthrough"`, not `"compile"`.** Kickstand does not use `astro:assets`; the brand photos are pre-converted webp in `public/images/`. `"compile"` bundled sharp and the `/_image` endpoint into the Worker (about 300 KB, dead code that would crash if hit). Cloudflare Images transformations for listing photos (thumbnails in several sizes) are a possible later upgrade, not built.
- **Config is read lazily, in one place** (`src/lib/env.ts`). The platform module provides `readVar` / `readBinding`: on Workers from `import { env } from "cloudflare:workers"`, on Node from `process.env` and Astro's `.env` loading. The DB client, Better Auth and storage are created on first use. `db` stays importable as before through a small Proxy, so the data layer did not change.
- **libSQL client by platform, not by URL.** The prompt suggested choosing by URL prefix with a dynamic import. The `#platform` condition already separates the bundles, so `cloudflare.ts` imports `@libsql/client/web` + `drizzle-orm/libsql/web` and `node.ts` the full client. A `file:` URL on Workers fails with a clear error. `npm run check:bundle` fails on native libSQL, sharp or `node:fs` in the bundle.
- **Rate limiting:** Workers Rate Limiting bindings for login (IP, e-mail) and messages per minute. The binding only supports 10 s or 60 s periods, so the windows are per minute there (20 / 5 / 10). The hourly message limit has no binding and stays in memory per isolate: weak, but harmless.
- **Smart placement** so the Worker runs near Turso in eu-west-1.
- **Cache-Control in the middleware:** `/` and `/so-gehts` get `s-maxage=60, stale-while-revalidate=600` **only for logged-out visitors** (with `Vary: Cookie`), because the header shows the member. Personal pages, auth pages and `/api/*` get `private, no-store`. Endpoints that set their own header keep it.
- **Time zone:** every displayed wall-clock time goes through `berlinParts()` (`Intl` with `Europe/Berlin`): `formatTimestamp`, `todayIso`, `relativeDate`, `memberSince`, the return form default. Tests pass with `TZ=UTC`.
- **Message poll is one indexed query** (`pollMessages`: conversation by primary key, membership in the WHERE, messages by `conversationId + createdAt`); the read marker is only written when something is unread.
- **`--remote` for `db:migrate` / `db:seed`** loads `.env.turso`. The remote seed asks before wiping (`--yes` to skip) and writes its photos to `./data/seed-uploads` for `npm run r2:upload`.
- **`SHOW_DEMO_LOGINS=true`** on the Worker: production was empty (0 members), so it was seeded with the demo data. Set it to `false` and reseed or clean up before real members join.
- **`npm run preview`** needs a libSQL server over HTTP (Docker). It was not run in this pass; the smoke test ran against the deployed Worker instead.
- **Bugs found while smoke-testing production** (all older than this pass): `.gitignore`'s `data/` also matched `src/lib/data/`, so the whole data layer was missing from git; on Workers an empty multi-file input arrives as `""`, which made every listing and loan form without a photo fail with 400 (`photoFiles` in `src/actions/util.ts`); with JS, the listing form never submitted once a photo was chosen, because its `requestSubmit()` ran while the first submit event was still being dispatched.

## Languages (November 2026)

- **Six languages: DE, EN, FR, ES, IT, PT (Portugal)**, chosen by Edgar. German stays at the plain URLs, so no existing link breaks; the others get a path prefix (good for search engines and shareable links) instead of a cookie.
- **No separate page files per language.** The middleware strips the prefix and renders the German route (`next(url)` rewrite); links and redirects are prefixed afterwards by rewriting `href`, `action`, `formaction` and `Location` (`src/i18n/links.ts`). Pages and actions did not have to learn about languages for their paths. Shared paths (`/media`, `/api`, `/_astro`, `/images`) are never prefixed. The cost is one string pass over each non-German HTML response, small for these pages.
- **German text as the key** instead of ids like `listing.new.title`: the code stays readable, nothing ever shows a raw key, and server messages already thrown in German (actions, data layer) can be translated where they are displayed. `npm run i18n:keys` collects literal `t` / `tk` / `ct` calls, so keys must be literal strings; messages built with `${…}` were rewritten as fixed sentences where possible (e.g. "Höchstens 4000 Zeichen.").
- **Tone:** informal like the German "du" in EN, ES, IT and PT; "vous" in French. Translations were written by Claude and should get a native read before a big launch.
- **Dates:** German keeps "23.10.2026, 14:05 Uhr"; other languages show "23/10/2026, 14:05", always in Berlin time. Date fields accept "23.10.2026" and "23/10/2026".
- **Binding texts stay German:** the Leihvertrag PDF (German law, §§ 598 ff. BGB), Impressum and Datenschutz. A machine translation of a contract can be wrong in ways that matter; the other languages show a note that the German text is binding.
- **The message poll** (`/api/…`, no prefix) gets the language as `?lang=` for its formatted times.

## The story page (`/touren`)

- **Text from Edgar's old blog**, recovered from the Internet Archive (2022 snapshots) into `reference/vlogato-blog/`; nothing invented. Trips without recovered text (Portugal, India, Colombia) show photos only, until Edgar writes something.
- **vlogato.com no longer belongs to Edgar** (it redirects to an unrelated site), so the page no longer links there; it mentions the blog by name only.
- **28 new photos** from the trip folders (`reference/touren-photos.json` lists the source of each). Left out: strangers as the subject, children, other people's licence plates, documents.

## Public contract generator (`/leihvertrag`, November 2026)

- **"PublicLayout" is `Base.astro`.** The prompt names a layout that does not exist; Base already is design A. New prop `dockFooter`: the sticky bar stays, and so do Impressum and the language switch, which a public page needs. The wizard keeps hiding the footer.
- **Shared parts:** the wizard's cards became `LoanBorrowerFields`, `LoanPeriodFields`, `LoanItemsFields`, `LoanHandoverFields`, `LoanSignatures`. `src/lib/contract-form.ts` maps form fields to `ContractData` and holds the rules (moved from `finalizeProblems` in the action). `saveContractPdf()` in `src/scripts/pdf.ts` is the one way out for both paths, and the contract text stays only in `buildContractPdf()`.
- **The form cannot post.** `method="dialog"`, all buttons `type="button"`, the photo inputs have no `name`. Without JS, a plain form would send every field in a GET URL to the server and its logs when someone presses Enter. `photo-utils.ts` holds the photo helpers without the `astro:actions` import, and the save code (`contract-save.ts`) only loads when a member taps the button.
- **Privacy check (6 Nov 2026, Playwright against the Node build, phone profile):** logged out, from page load through filling in, 2 photos, 2 signatures and the downloaded PDF: 11 same-origin requests, all `GET` for the page or `/_astro/*`, no POST, no form data in any URL. Plus 4 requests to Google Fonts, as on every page. Those carry no form data but do show Google the visitor's IP. To be repeated on production after deploying.
- **Lender snapshot on `Loan`** (`lenderName`, `lenderStreet`, `lenderZipCity`, migration `0002`). The generator allows any lender, while saved contracts took the lender from the profile, so the saved PDF could have named someone other than the signed one. Null on older loans: they keep using the profile.
- **Saving is two steps:** `saveGenerated` writes bike and draft, the photos go up through the existing `uploadPhoto`, then `activate` runs the same checks as "Abschließen". A dropped connection leaves a draft to resume, and tapping again continues. Return photos follow after `activate`, because the server only takes them on an active loan.
- **Existing bike:** same FIN, or same plate when one side has no FIN. Two different FINs never join through a plate. The form's data wins, so the saved PDF matches the signed one; the bike's default cap, photo and free text in Feld 22 are kept. A bike with an active loan is refused.
- **Feld 22 wording:** the switch gives the sentence from the contract template in § 4 Abs. 3 (`reference/leihvertrag-ausfuellen.md`). The code had a generic § 4 Abs. 5 instead. The exact condition "Beifahrer nur mit Fußrasten" now gets the template sentence in the wizard too; any other free text stays Abs. 5.
- **No made-up time in the protocol:** a loan without a start time used to print "00:00 Uhr" in the handover column. It now prints the date alone, on both paths.
- **Missing required fields** (template, Teil 2) are listed once; a second tap builds the PDF with blanks to fill in by hand. Unparseable dates, times and numbers always block, because they would silently vanish from the contract.
- **Marke and Modell are two fields**, as in the bike form (D.1, D.3), not the template's single field, because `Bike` stores them apart.
- **iOS:** always a Blob with `<a download>`; iPhones and iPads also get a visible "PDF öffnen" link, since a new tab opened after async work is blocked as a popup.
- **Header:** "Leihvertrag" is the first item, also on phones. The prompt says "before So geht's", but the header has no "So geht's" (see Design), so it sits before "Suchen".
- **Start page:** generator first, as in the prompt. The "Garagen & Hilfe" section now shows 3 listings instead of 6, as the prompt asks, although it also lists the section as "unchanged".

## Seed

- **13 listings** instead of "~12", so every category has at least one. Fixed join dates make "Mitglied seit" stable.
- The tour listing in PT uses `myanmar.jpg` as its cover; the VFR listing has no photo.

## Redesign: marketplace with Benno (November 2026)

The design A notes under "Design" above are replaced by this section where they disagree. Spec: the canvas "Kickstand Redesign – Marktplatz mit Maskottchen" plus the written prompt.

### Layout and navigation

- **Still one layout.** The prompt names `PublicLayout` and `AppLayout`; only `Base.astro` exists. It picks the header by path: on `/anzeigen*`, `/app*`, `/nachrichten*`, `/merkliste` and `/profil` the compact search (keyword + Ort + "Finden") with "Anzeigen" and "Nachrichten"; everywhere else the public nav. New props `mobileBar` (page draws its own phone top bar), `mobileDock` (fixed bar on phones only, footer stays) and a `before` slot above `main`.
- **On the results page both search forms carry each other's fields** (hidden inputs), so the header search keeps the filters and the filter card keeps keyword and Ort.
- **Header says "Anzeigen"** as the prompt asks (it used to say "Suchen"); the phone tab bar keeps "Suchen".
- **Phones:** the header holds only logo and Anmelden or the avatar (plus the search row on search pages). "Leihvertrag" no longer fits next to the wordmark at 360 px; it is reached from the start page band and the footer. The Merkliste heart and "+ Anzeige aufgeben" are desktop only, the tab bar has both.
- **"Sicherheit" links to `/#sicherheit`**, the safety section on the start page. No separate page. "So geht's" links to the existing `/so-gehts`.
- **Footer:** "Edgars Touren" instead of "Über uns" (that page is the story page; the Vlogato mention lives only there now). No "Nutzungsbedingungen": there is no such page. The category column uses the `CATEGORIES` constant, not a DB query per page. The language switch sits in the bottom line next to "Kickstand · ein Projekt von Edgar Kretschmann".
- **Language picker in the header** (globe + code on desktop, globe alone on phones), a `<details>` menu like the avatar menu, so it works without JS. Added after Edgar found the footer-only switch too hidden. The detail page on phones hides the site header, so there only the footer switch is left.

### Start page

- **"Neueste Anzeigen" instead of "Neu in deiner Nähe".** Kickstand does not know where a visitor is; the list is simply the newest 8 active listings anywhere.
- **"Beliebt:" links are categories or single words** (Garage / Stellplatz, Hebebühne, Motorrad zum Leihen, Hilfe beim Schrauben). Every word of a search must match, so the canvas examples ("Garage für den Winter") would find nothing.
- **Hearts on the tiles are real:** a form that posts the existing `listings.save` action to the listing's page, which then shows "Auf deiner Merkliste". Visitors go to login; your own listings have no heart. Works without JS.
- **Category tiles show no counts** (the prompt allows counts only from the DB; not worth a query on a cached page).
- **The rider photo, brush stroke and sky oval are gone** from the start page; `public/images/rider-*` and `myanmar-*` stay, `/touren` still uses them. Its oval frame is now petrol-wash.

### Search (`/anzeigen`)

- **Price filter added to the data layer** (`SearchFilters.price`, tested), because the prompt asks for the checkboxes unconditionally. "Mit Preis" and "VB" are separate boxes, so all four price kinds can be picked; unknown values are ignored.
- **Umkreis and Land are left out.** Listings have no coordinates and the search has no country filter. The canvas "Sortieren" select is left out too: results are always newest first.
- **Filters apply on change with JS;** without JS the "Anwenden" button submits the same GET form. On phones, category and price fold into "Kategorie und Preis" (with the active one shown as a chip); on wide screens JS opens it and hides the summary.
- **Cards gained `photoCount` and `teaser`** (first 160 characters, cut in SQL with `substr`, whitespace collapsed). The seller in the detail gained `activeListings`. All additive.

### Listing detail

- **Phones get the board's top bar** (back, category, share) instead of the site header, and a fixed bottom bar instead of the tab bar. The footer stays.
- **Back goes to the category's list,** not `history.back()`, so it also works from a shared link. **Share** uses the system share sheet, or copies the link; hidden without JS. The "1 / n" counter needs JS too; desktop keeps the thumbnails.
- **"Nachricht schreiben" in the bar jumps to the message form** (`#kontakt`), which stays in the page as before. Visitors go to login.
- **Owner bar:** an icon button for Bearbeiten (three text buttons do not fit at 360 px), "Status" jumping to the owner panel (`#verwalten`), and "Leihvertrag starten" for a bike offer without an active loan.
- **The details table shows only stored data:** Art, Kategorie, the bike's facts, Status ("verfügbar", "verliehen", "Reserviert", "Erledigt"). The board's "Führerschein: Klasse A" is not stored and not shown.
- **Seller card:** initial, first name, "Mitglied seit", number of active listings. No "Profil" link: there are no public profiles.
- **"Wo" is a grey box with Ort/PLZ, not a map.** There is no geodata.
- **"Anzeige melden" links to `/impressum`** for now. There is no report flow and no contact address yet. **To do before real members join.**
- **Benno-Tipp per category** in `src/lib/benno-tips.ts` (translatable). `motorrad-leihen` has the handover-photo tip from the board.

### Tokens and components

- **Derived variables besides the prompt's table:** `--on-dark` (white text on ink/petrol), `--on-dark-muted` `#C9D0D3` (11:1 on ink), `--line-strong` `#8C9599` (field outlines, 3:1 on white as WCAG asks for input borders; `--line` alone is 1.2:1), `--amber-ink` `#8A5A00` (icons on amber-wash, from the canvas, 5.3:1), `--stone` (place box), `--scrim` (photo-count badges), `--danger`. Contrast checked: muted on white 6.1, on ground 5.6; petrol on petrol-wash 5.2; white on petrol 6.1; ink on amber 9.8.
- **Benno's colours are literal hex inside the SVGs.** The mascot is artwork, not UI, so it does not go through variables; `--beaver` exists only to document the colour.
- **Chips:** Biete petrol on petrol-wash, Suche ink on amber. **Buttons:** plain `button`/`.btn` is now the white secondary pill, `.btn-primary` petrol, `.btn-dark` ink. Segmented controls: grey track, petrol when selected. `.btn-sky` and the aliases `--fg`, `--accent`, `--doc` stay for the loan pages.
- **Tiles vs rows:** `ListingCard` is the tile (start page, Merkliste, Mein Bereich; two columns on phones), the new `ListingRow` the search result row.
- **Empty states with `BennoWave`:** search, start page, Nachrichten, Merkliste, and "no listings" in Mein Bereich. The other dashboard empties stay one line, so the page is not full of beavers.
- **New texts were translated by Claude** into EN, FR, ES, IT, PT (FR with "vous"); the start page strings of design A were removed from the locale files.
- **The contract PDF is unchanged.**

## Domain kickstand.top and a new Google login client (9 November 2026)

- **kickstand.top is the address.** Registered at Namecheap, nameservers moved to Cloudflare (zone on the hello@deutschacademy.com account, free plan) so the Worker can use it as a custom domain. `www.kickstand.top` and the former `kickstand.deutschacademy.com` stay attached to the Worker and 301-redirect to it, keeping path and query, so old links and bookmarks keep working and sessions live on one origin. The list is the var `REDIRECT_HOSTS`; the workers.dev rule is unchanged.
- **Google login moved to a project under hello@deutschacademy.com** (`kickstand-514221`, client "Kickstand Web"). The old project belonged to a private Gmail account that the deutschacademy browser profile cannot reach, and the consent screen should name the site's own contact. Existing Google-linked members are unaffected: Google's account id (`sub`) is the same for every client, and that is what Better Auth stores.
