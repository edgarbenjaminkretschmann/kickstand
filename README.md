# Kickstand

A small marketplace for motorcyclists. People post what they offer (*Biete*) and what they are looking for (*Suche*): a motorcycle to borrow, a garage spot, tools, parts, help with a repair, a tour partner. Lending a motorcycle ends in a free Leihvertrag (§§ 598 ff. BGB) with handover protocol, photos, signatures and a PDF. Mobile first, in six languages (German, English, French, Spanish, Italian, Portuguese), small enough for one person to run.

- Astro 5 (SSR), Astro Actions for every form. Production runs on Cloudflare Workers (`@astrojs/cloudflare`); `npm run dev`, the tests and the Docker image run on Node
- Drizzle ORM on libSQL / SQLite (`drizzle-kit` migrations), written to stay portable to Postgres
- Better Auth: email + password, and Google login when configured
- Photos resized to max 1600 px (`sharp` on Node, Cloudflare Images on Workers), stored through a small storage adapter (local disk or Cloudflare R2)
- Production: Cloudflare Workers + Turso + R2 (see "Deploying to Cloudflare"). Local dev needs no accounts and no env vars
- Contract PDF built in the browser with jsPDF (`src/lib/contract-pdf.ts`)
- No analytics. Fonts from Google Fonts (Barlow Semi Condensed, Inter)

## Brand

A marketplace look: search first, white cards on a light ground, borders instead of shadows, no gradients, no emoji. Light theme only.

- **Benno, der Biber** carries the brand: riding goggles, petrol neckerchief, a wrench. Three inline-SVG components in `src/components/benno/`: `BennoMark` (head in a circle: logo, favicon, avatars, tip boxes), `Benno` (full body with wrench: start page hero) and `BennoWave` (waving: safety tips, empty states). Each takes `size` and `label` (empty = decorative). `public/favicon.svg` and `public/apple-touch-icon.png` are made from `BennoMark`.
- **Colours** (all as CSS variables in `src/styles/global.css`): ink `#14181B`, petrol `#0B6E6C` (primary, "Biete"), petrol-dark `#08504F`, petrol-wash `#E3F1F0`, amber `#FFB020` ("Suche", badges), amber-wash `#FFF1D6`, ground `#F5F6F4`, card `#FFFFFF`, line `#E2E5E3`, text-2 `#3B4449`, muted `#5A6469`. Benno's brown `#8A5A3B` lives only inside the mascot, never in UI.
- **Type:** Barlow Semi Condensed 600–800 for headings, prices, step numbers and the wordmark "kickstand"; Inter 400–700 for everything else. Inputs are 16 px.
- **Radii:** cards 16 px, big sections 24 px, pills fully round.

## Setup

Requires Node 20+ (22 recommended).

```sh
npm install
npm run db:migrate   # creates ./data/kickstand.db
npm run db:seed      # demo data (wipes the database first)
npm run dev
```

Open http://localhost:4321.

| | |
|---|---|
| Demo login | `demo@kickstand.test` / `kickstand-demo` |
| Second user | `max@kickstand.test` / `kickstand-demo` |
| Data | 13 listings in all categories (DE and PT), the Honda VFR 750 F as a bike listing, one returned loan, one conversation, two saved listings |

`npm run db:reset` deletes the local SQLite file and runs migrate + seed again (stop the dev server first on Windows).

Every form works without JavaScript, except the public generator `/leihvertrag`, which builds its PDF in the browser. JS adds the signature pads, client-side photo resizing, draft autosave, sending messages without reload, the 15 s message poll and the PDF button.

### Database scripts

| Script | What it does |
|---|---|
| `npm run db:generate` | After changing `src/db/schema.ts`: writes a new SQL migration to `./drizzle` |
| `npm run db:migrate` | Applies pending migrations (`scripts/migrate.mjs`, plain JS, also used in Docker). `-- --remote`: against Turso, credentials from `.env.turso` |
| `npm run db:seed` | Wipes all rows and inserts the demo data. Refuses with `NODE_ENV=production` unless `--force`. `-- --remote`: seeds Turso (asks first, `--yes` skips the question) and writes the photos to `./data/seed-uploads` for `npm run r2:upload` |
| `npm run db:migrate-legacy` | One-off: copies a Phase 1 Astro DB file into the new schema (see below) |

### Tests

```sh
npm test               # Vitest: contract PDF, form mapper, euro words, dates, listing search and rules, conversation access, platform bits
npm run check          # astro check (types)
npm run check:bundle   # builds the Worker, wrangler dry-run, fails if native libSQL, sharp or node:fs is in the bundle
```

Tests run on a fresh in-memory database with the real migrations.

## Environment variables

`npm run dev` needs none of these. All of them are read at request time through `src/lib/env.ts`, never at import.

| Name | Kind | Local (`npm run dev`) | Cloudflare |
|---|---|---|---|
| `DATABASE_URL` | var | `file:./data/kickstand.db` (default) | `libsql://kickstand-kickstand.aws-eu-west-1.turso.io` |
| `DATABASE_AUTH_TOKEN` | secret | – | Turso read & write token |
| `BETTER_AUTH_SECRET` | secret | any string (a dev default is used if empty) | `openssl rand -hex 32` |
| `SITE_URL` | var | `http://localhost:4321` (default) | `https://kickstand.deutschacademy.com`. Also read by `astro.config.mjs` at build time |
| `BETTER_AUTH_URL` | var | optional, defaults to `SITE_URL` | same as `SITE_URL` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | optional | from Google Cloud Console. Both set: "Mit Google anmelden" shows |
| `SHOW_DEMO_LOGINS` | var | always shown in dev | `true` for the demo, `false` once real members use it |
| `UPLOAD_DIR` | var | `./uploads` (default) | – (photos go to R2) |
| `PHOTOS` | R2 binding | – (disk) | bucket `kickstand-photos`, private |
| `IMAGES` | Images binding | – (sharp) | resizes uploads |
| `LOGIN_IP_LIMITER`, `LOGIN_EMAIL_LIMITER`, `MESSAGE_LIMITER` | rate-limit bindings | – (in memory) | declared in `wrangler.jsonc` |

On Cloudflare, plain vars live in `wrangler.jsonc` → `vars`; secrets are set with `npx wrangler secret put <NAME>`. Never commit tokens: `.env*` (except `.env.example`), `.dev.vars` and `.wrangler/` are git-ignored. Copy `.env.example` to `.env` for local overrides, and `.dev.vars.example` to `.dev.vars` for `npm run preview`. With `--remote`, the database scripts read the Turso credentials from `.env.turso`.

## Google login

1. Open the [Google Cloud Console](https://console.cloud.google.com/), pick or create a project.
2. **APIs & Services → OAuth consent screen**: user type *External*, app name "Kickstand", your support e-mail. Scopes: the default `openid`, `email`, `profile` are enough. While the app is in *Testing*, add the Google accounts that may log in as test users; publish it when you go live.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type *Web application*.
   - Authorised JavaScript origins: `http://localhost:4321` and your production origin, e.g. `https://kickstand.example`
   - Authorised redirect URIs:
     - `http://localhost:4321/api/auth/callback/google`
     - `https://kickstand.example/api/auth/callback/google`
4. Put the client id and secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and restart.

The first Google login creates the member with the display name from Google and sends them to `/profil`, where they add the private contract fields (full name, address, birth date, licence) later. A Google login with the same verified e-mail as an existing email + password account joins that account.

## Production without Docker (Node)

```sh
export SITE_URL=https://kickstand.example
export DATABASE_URL=file:./data/kickstand.db      # or a Turso URL + DATABASE_AUTH_TOKEN
KICKSTAND_TARGET=node npm run build                # the default build is the Worker
npm run db:migrate
BETTER_AUTH_SECRET=... UPLOAD_DIR=./data/uploads PORT=4321 HOST=0.0.0.0 npm start
```

Seed demo data into a production database only if you really want it: `NODE_ENV=production npm run db:seed -- --force`.

## Deploying to Cloudflare

Production: the app runs as a Worker on the Workers Paid plan, the database is Turso (AWS eu-west-1), and photos live in the private R2 bucket `kickstand-photos`. Live at https://kickstand.deutschacademy.com (custom domain on the deutschacademy.com zone, set in `wrangler.jsonc` → `routes`). The old address https://kickstand.jolly-wildflower-4370.workers.dev stays on and 301-redirects there.

There is one `astro.config.mjs`. It builds for Cloudflare by default; `KICKSTAND_TARGET=node` builds the Node server for Docker. The `#platform` import (`package.json` → `imports`) resolves to `src/platform/cloudflare.ts` in the Worker bundle (HTTP-only libSQL client, R2, Cloudflare Images, rate-limit bindings) and to `src/platform/node.ts` everywhere else (full libSQL client with `file:` URLs, disk, sharp). So the native libSQL client, sharp and `node:fs` never reach the Worker, and `npm run check:bundle` proves it.

| Script | What it does |
|---|---|
| `npm run dev` | `astro dev` on Node, local SQLite file and photos on disk. No Wrangler, no accounts |
| `npm run preview` | Build + `wrangler dev` (local R2 and Images simulation, values from `.dev.vars`) |
| `npm run deploy` | Build + `wrangler deploy` |

**Set up once:**

1. **Git:** work on a branch; `main` stays deployable.
2. **Login:** `npx wrangler login` with the Cloudflare account that has Workers Paid (Workers & Pages → Plans). `npx wrangler whoami` should show `hello@deutschacademy.com`.
3. **Bucket:** `npx wrangler r2 bucket create kickstand-photos --location weur`. Leave public access **off**: every photo goes through `/media/*`, which checks access first (listing photos are public there; loan and bike photos are not).
4. **Turso:** a database in AWS eu-west-1 and a read & write token. Put both into `.env.turso` (git-ignored) as `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`, then run `npm run db:migrate -- --remote`. For demo data: `npm run db:seed -- --remote`, then `UPLOAD_DIR=./data/seed-uploads npm run r2:upload`.
5. **Secrets:** `npx wrangler secret put DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. **Deploy:** `npm run deploy`.
7. **Google OAuth:** add the origin `https://kickstand.deutschacademy.com` and the redirect URI `https://kickstand.deutschacademy.com/api/auth/callback/google` to the OAuth client. Preview version URLs (`<version>-kickstand...workers.dev`) do not work for Google login, because Google only accepts listed redirect URIs; use email login there.
8. **Another domain:** change `routes`, `SITE_URL` and `BETTER_AUTH_URL` in `wrangler.jsonc`, add the new Google redirect URI, and deploy. Wrangler creates the DNS record and certificate if the zone is on the same account.

**Later schema changes:** `npm run db:generate` → `npm run db:migrate -- --remote` → `npm run deploy`. Migrations never run inside the Worker.

**Try the Worker locally:** `npm run preview` needs a database reachable over HTTP (Workers cannot open `file:` URLs), e.g. a local libSQL server: `docker run -d -p 127.0.0.1:8088:8080 ghcr.io/tursodatabase/libsql-server`, then `DATABASE_URL=http://127.0.0.1:8088 npm run db:migrate`, with the values from `.dev.vars.example` in `.dev.vars`.

**Differences from the Node server:**
- Uploads: max 20 MB per photo (Cloudflare Images input limit; 25 MB on Node). With JS, photos are shrunk in the browser first anyway. Without JS, the Images binding resizes and rotates and a small JS step removes EXIF/GPS (`stripJpegMetadata`).
- Rate limits use the Workers Rate Limiting binding, which only knows 10 s or 60 s windows: 20 login attempts per IP and 5 per e-mail a minute, 10 messages a minute. The hourly message limit stays in memory per isolate.
- Dates and times are always formatted in `Europe/Berlin`; Workers run in UTC.
- Caching: `/` and `/so-gehts` send `s-maxage=60, stale-while-revalidate=600` to logged-out visitors; personal pages and `/api/*` send `private, no-store`. Workers on workers.dev do not cache responses by themselves, so this only matters once a cache sits in front.

## Docker deploy

One image, one container. Two named volumes hold the SQLite file (`/data/db`) and the photos (`/data/uploads`).

```sh
cat > .env <<'ENV'
BETTER_AUTH_SECRET=<long random string>
SITE_URL=https://kickstand.example
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ENV
docker compose up -d --build
```

The image builds with `KICKSTAND_TARGET=node`. On every start the container applies pending migrations (`node scripts/migrate.mjs`), then starts the Node server on port 4321. `SITE_URL` is a build argument, so rebuild after changing it. Put a reverse proxy with TLS (Caddy, nginx) in front, forwarding `Host` and `X-Forwarded-Proto`:

```
kickstand.example {
  reverse_proxy localhost:4321
}
```

To use Turso instead of the local file, set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `.env`. The `db` volume is then unused.

**Backups:** copy the two volumes (`docker run --rm -v kickstand_db:/d -v $PWD:/b alpine tar czf /b/db.tgz -C /d .`, same for `kickstand_uploads`).

## Upgrading from Phase 1 (Astro DB)

Phase 1 stored everything through `@astrojs/db`. Keep the old SQLite file, then:

```sh
npm run db:migrate
LEGACY_DATABASE_URL=file:./data/astro-db-legacy.db npm run db:migrate-legacy
```

Members, sessions, bikes, loans, protocols, photos and signatures are copied with the same ids (photo files stay where they are). Board posts become listings, every lendable bike becomes a "Motorrad zum Leihen" listing, and loan requests become conversations about that listing. Running it twice changes nothing. Details in `docs/DECISIONS.md`.

## Languages

German is the source language and lives at the plain URLs (`/anzeigen`). English, French, Spanish, Italian and Portuguese (Portugal) live under a prefix (`/en/anzeigen`, `/fr/…`, `/es/…`, `/it/…`, `/pt/…`). The footer has a language switcher, and every page lists its versions as `hreflang` links.

- **How it works:** the middleware reads the prefix, sets `locals.lang` and renders the same page as the German URL. On the way out, `src/i18n/links.ts` prefixes in-site links, form targets and redirects, so pages and actions keep using plain German paths. `/de/…` redirects to the plain URL (the switcher uses it).
- **Texts:** looked up by their German wording. `const { t } = i18n(Astro.locals.lang)` and `t("Anzeige aufgeben")` in templates; `t(lang, "…")` in TypeScript; `tk("…")` marks German messages that are thrown or stored and translated where they are shown; `ct("…")` in browser scripts (Base.astro embeds just those strings). A missing translation falls back to German.
- **Dictionaries:** `src/i18n/locales/<lang>.json`. After adding or changing a German string, run `npm run i18n:keys`: it rewrites `src/i18n/keys.json` (every source string and where it is used) and lists missing translations per language. `npm run i18n:keys -- --check` fails if any are missing.
- **"So geht's":** `src/content/pages/so-gehts-<lang>.md`, falling back to `so-gehts.md`.
- **Stays German on purpose:** the Leihvertrag PDF, Impressum and Datenschutz. They are the binding texts under German law; other languages show a note saying so. Listings and messages are shown as their authors wrote them.

## How things fit together

```
src/db/schema.ts        all tables (Better Auth, Profile, Bike, Loan, Protocol, Photo, Signature,
                        category, listing, listing_photo, saved_listing, conversation, message)
src/db/client.ts        the one database connection, created on first use (only src/lib/data and src/lib/auth use it)
src/lib/env.ts          the one place that reads vars, secrets and bindings (lazily)
src/db/seed-data.ts     demo data (scripts/seed.ts)
drizzle/                SQL migrations (0001 inserts the categories)
src/lib/data/           ALL database access: listings, conversations, bikes, loans, profiles, saved
src/lib/auth/           ALL auth: getUser, requireUser, sign-in/up/out, Google
src/lib/storage/        StorageAdapter: local.ts (disk), r2.ts (Cloudflare R2), google.ts (stub)
src/platform/           node.ts (libSQL + sharp + disk) / cloudflare.ts (libSQL web + Images + R2), imported as "#platform"
src/middleware.ts       session -> locals.user, guards /app, /nachrichten, /merkliste, /profil, posting
src/actions/            form handlers (auth, profile, bikes, loans, listings, messages)
src/pages/anzeigen/     search, detail, neu, bearbeiten
src/pages/nachrichten/  conversations list and thread
src/pages/app/          Mein Bereich, bikes, loan wizard, return protocol
src/pages/leihvertrag.astro  public contract generator, browser only until a member saves
src/pages/media/        listing photos (public), bike/protocol photos and signatures (access-checked)
src/lib/contract-pdf.ts buildContractPdf(data): pure, runs in browser and in Vitest
src/lib/contract-form.ts form fields -> contract data and the checks, shared by generator and actions
docs/                   MIGRATION-GOOGLE.md, DECISIONS.md
```

Actions and pages never import Drizzle, the schema or Better Auth directly; they go through `src/lib/data`, `src/lib/auth` and `src/lib/storage`. That is what makes the later move to Google a matter of a few files (see `docs/MIGRATION-GOOGLE.md`).

### Rules worth knowing

- **Search** shows only `aktiv` listings, newest first, 20 per page. Keyword matches title and description (every word must appear), Ort/PLZ matches as a prefix.
- **Bike listings:** "Motorrad zum Leihen" + "Biete" must link one of your own bikes and is always free. While the bike has an active loan the listing shows "verliehen" and takes no new messages.
- **Leihvertrag ohne Konto (`/leihvertrag`):** works for any motorcycle, lender and borrower, with no login. Privacy: until a member taps "In meinem Konto speichern", no form field leaves the browser. Texts and switches are a draft in `localStorage`; photos and signatures stay in memory; the PDF is built on the device. The form cannot post (`method="dialog"`). Saving creates the bike if it is new (same FIN or plate as one of your bikes: that bike, updated) and an `active` loan, then uploads the photos. The page itself loads only static assets, plus the Google Fonts every page uses.
- **Leihvertrag starten:** the owner starts the loan wizard from the listing or from a conversation about it; the wizard is prefilled from the other member's profile. The borrower can also have no account.
- **Access:** only the owner edits a listing. A conversation is visible only to its two members. Loan photos, signatures and the contract data are served only to the lender and to the member of the conversation linked to the loan.
- **One active loan per bike.** Finalising a contract checks this.
- **Dates** are stored as ISO strings and shown as `DD.MM.YYYY`. Date and time fields are text inputs (`TT.MM.JJJJ`, `HH:MM`) parsed on the server, because `<input type="date">` follows the browser locale.
- **Drafts:** the contract wizard autosaves as a draft (debounced, and immediately when the tab is hidden). "Abschließen" sets the loan `active`; the return protocol sets it `returned`.
- **Rate limits** (`src/lib/rate-limit.ts`): locally in memory, 10 login attempts per e-mail and 30 per IP in 10 minutes, 10 messages a minute and 120 an hour per member. On Workers see "Differences from the Node server".
- **Notifications:** none yet. `notifyNewMessage()` in `src/lib/notify.ts` is the hook for e-mail or push later.

Astro's action body limit is raised to 80 MB (`astro.config.mjs`) so phones without JS can upload full-size photos; with JS, photos are shrunk before upload.
