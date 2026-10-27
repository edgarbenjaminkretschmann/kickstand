# Kickstand

A small marketplace for motorcyclists, a sister project of [vlogato.com](https://vlogato.com). People post what they offer (*Biete*) and what they are looking for (*Suche*): a motorcycle to borrow, a garage spot, tools, parts, help with a repair, a tour partner. Lending a motorcycle ends in a free Leihvertrag (§§ 598 ff. BGB) with handover protocol, photos, signatures and a PDF. Mobile first, German UI, small enough for one person on one VPS.

- Astro 5 (SSR, `@astrojs/node` standalone), Astro Actions for every form
- Drizzle ORM on libSQL / SQLite (`drizzle-kit` migrations), written to stay portable to Postgres
- Better Auth: email + password, and Google login when configured
- Photos resized to max 1600 px (`sharp` on Node, Cloudflare Images on Workers), stored through a small storage adapter (local disk or Cloudflare R2)
- Runs on Node (dev, Docker) or on Cloudflare Workers with Turso + R2 (see "Deploy to Cloudflare Workers")
- Contract PDF built in the browser with jsPDF (`src/lib/contract-pdf.ts`)
- No paid services, no analytics. Fonts from Google Fonts (Mr Dafoe, Roboto Slab, Open Sans)

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

Every form works without JavaScript. JS adds the signature pads, client-side photo resizing, draft autosave, sending messages without reload, the 15 s message poll and the PDF button.

### Database scripts

| Script | What it does |
|---|---|
| `npm run db:generate` | After changing `src/db/schema.ts`: writes a new SQL migration to `./drizzle` |
| `npm run db:migrate` | Applies pending migrations (`scripts/migrate.mjs`, plain JS, also used in Docker) |
| `npm run db:seed` | Wipes all rows and inserts the demo data. Refuses with `NODE_ENV=production` unless `--force` |
| `npm run db:migrate-legacy` | One-off: copies a Phase 1 Astro DB file into the new schema (see below) |

### Tests

```sh
npm test        # Vitest: contract PDF, euro words, dates, listing search and rules, conversation access
npm run check   # astro check (types)
```

Tests run on a fresh in-memory database with the real migrations.

## Environment variables

| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | optional | libSQL URL. Default `file:./data/kickstand.db`. Turso: `libsql://<db>-<org>.turso.io`. Read at runtime. |
| `DATABASE_AUTH_TOKEN` | Turso only | Auth token for a remote libSQL database. |
| `BETTER_AUTH_SECRET` | production | Long random string for signing sessions, e.g. `openssl rand -hex 32`. The server refuses to start in production without it. |
| `SITE_URL` | production (build) | Public URL, e.g. `https://kickstand.example`. Astro only trusts the `Host` header for listed domains; without it every form POST fails the origin check. Also the fallback for `BETTER_AUTH_URL`. |
| `BETTER_AUTH_URL` | optional | Base URL for Better Auth (OAuth callbacks). Defaults to `SITE_URL`. |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth client id. Together with the secret this shows "Mit Google anmelden". |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth client secret. If either Google variable is empty the button is hidden and nothing breaks. |
| `UPLOAD_DIR` | optional | Where photos are stored on Node. Default `./uploads`. On Workers photos go to the R2 binding `PHOTOS` instead. |

Copy `.env.example` to `.env` for local use.

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

## Production without Docker

```sh
export SITE_URL=https://kickstand.example
export DATABASE_URL=file:./data/kickstand.db      # or a Turso URL + DATABASE_AUTH_TOKEN
npm run build
npm run db:migrate
BETTER_AUTH_SECRET=... UPLOAD_DIR=./data/uploads PORT=4321 HOST=0.0.0.0 npm start
```

Seed demo data into a production database only if you really want it: `NODE_ENV=production npm run db:seed -- --force`.

## Deploy to Cloudflare Workers

The production setup: the app runs as a Worker, the database is Turso (hosted libSQL/SQLite), photos live in a private R2 bucket and are resized by Cloudflare Images. Needs the Workers Paid plan ($5/month): password hashing and photo handling go past the free plan's 10 ms CPU limit.

The same code builds for both platforms. `astro.config.cloudflare.mjs` swaps the adapter, and the `#platform` import (`package.json` → `imports`) resolves to `src/platform/cloudflare.ts` (R2, Cloudflare Images) in the Workers build and to `src/platform/node.ts` (local disk, sharp) everywhere else. `@libsql/client` picks its web (HTTP) client on Workers by itself, so `DATABASE_URL` must be a `libsql://` or `https://` URL there; `file:` URLs only work on Node.

**Once:**

1. `npx wrangler login` (the account with the Workers Paid plan).
2. Turso: create a database (region AWS Frankfurt or Ireland) and a read & write token.
3. R2: `npx wrangler r2 bucket create kickstand-photos --location weur` (or in the dashboard). Leave public access off.
4. In `wrangler.jsonc`, set `vars.DATABASE_URL` to the Turso URL and `SITE_URL` / `BETTER_AUTH_URL` to the public URL (e.g. `https://kickstand.example`).
5. Secrets (typed in, never stored in the repo):
   ```sh
   npx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -hex 32
   npx wrangler secret put DATABASE_AUTH_TOKEN    # the Turso token
   npx wrangler secret put GOOGLE_CLIENT_ID       # optional
   npx wrangler secret put GOOGLE_CLIENT_SECRET   # optional
   ```
6. Domain: Workers & Pages → kickstand → Settings → Domains & Routes → add a custom domain (e.g. `kickstand.example`) on a zone in the same account.

**Every deploy:**

```sh
# 1. schema changes go to Turso first (run from your machine, not the Worker)
DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate
# 2. build with the public URL and upload
SITE_URL=https://kickstand.example npm run deploy:cf
```

**Demo data on a preview (optional):** the seed writes photos to disk, so seed against Turso and then copy the files into R2:

```sh
DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... UPLOAD_DIR=./data/seed-uploads npm run db:seed
UPLOAD_DIR=./data/seed-uploads npm run r2:upload
```

`npm run r2:upload` also moves an existing server's `uploads/` folder into R2 (keys stay the same).

**Try the Worker locally:** `npm run preview:cf` runs the build in `wrangler dev` (local R2, local low-fidelity Images). Put `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SITE_URL` and `BETTER_AUTH_URL` into `.dev.vars` (git-ignored). The database must be reachable over HTTP, e.g. a local libSQL server: `docker run -d -p 127.0.0.1:8088:8080 ghcr.io/tursodatabase/libsql-server` with `DATABASE_URL=http://127.0.0.1:8088`, then `npm run db:migrate` against that URL. Build with `SITE_URL=http://127.0.0.1:8787`.

**Differences from the Node server:**
- Uploads are limited to 20 MB per photo (Cloudflare Images input limit; 25 MB on Node). With JS, photos are shrunk in the browser first anyway.
- Rate limits are counted per Worker instance, so they are looser than on one Node process.
- Migrations never run inside the Worker; run `npm run db:migrate` against Turso before deploying.

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

On every start the container applies pending migrations (`node scripts/migrate.mjs`), then starts the Node server on port 4321. `SITE_URL` is a build argument, so rebuild after changing it. Put a reverse proxy with TLS (Caddy, nginx) in front, forwarding `Host` and `X-Forwarded-Proto`:

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

## How things fit together

```
src/db/schema.ts        all tables (Better Auth, Profile, Bike, Loan, Protocol, Photo, Signature,
                        category, listing, listing_photo, saved_listing, conversation, message)
src/db/client.ts        the one database connection (only src/lib/data and src/lib/auth use it)
src/db/seed-data.ts     demo data (scripts/seed.ts)
drizzle/                SQL migrations (0001 inserts the categories)
src/lib/data/           ALL database access: listings, conversations, bikes, loans, profiles, saved
src/lib/auth/           ALL auth: getUser, requireUser, sign-in/up/out, Google
src/lib/storage/        StorageAdapter: local.ts (disk), r2.ts (Cloudflare R2), google.ts (stub)
src/platform/           node.ts (sharp + disk) / cloudflare.ts (Images + R2), imported as "#platform"
src/middleware.ts       session -> locals.user, guards /app, /nachrichten, /merkliste, /profil, posting
src/actions/            form handlers (auth, profile, bikes, loans, listings, messages)
src/pages/anzeigen/     search, detail, neu, bearbeiten
src/pages/nachrichten/  conversations list and thread
src/pages/app/          Mein Bereich, bikes, loan wizard, return protocol
src/pages/media/        listing photos (public), bike/protocol photos and signatures (access-checked)
src/lib/contract-pdf.ts buildContractPdf(data): pure, runs in browser and in Vitest
docs/                   MIGRATION-GOOGLE.md, DECISIONS.md
```

Actions and pages never import Drizzle, the schema or Better Auth directly; they go through `src/lib/data`, `src/lib/auth` and `src/lib/storage`. That is what makes the later move to Google a matter of a few files (see `docs/MIGRATION-GOOGLE.md`).

### Rules worth knowing

- **Search** shows only `aktiv` listings, newest first, 20 per page. Keyword matches title and description (every word must appear), Ort/PLZ matches as a prefix.
- **Bike listings:** "Motorrad zum Leihen" + "Biete" must link one of your own bikes and is always free. While the bike has an active loan the listing shows "verliehen" and takes no new messages.
- **Leihvertrag starten:** the owner starts the loan wizard from the listing or from a conversation about it; the wizard is prefilled from the other member's profile. The borrower can also have no account.
- **Access:** only the owner edits a listing. A conversation is visible only to its two members. Loan photos, signatures and the contract data are served only to the lender and to the member of the conversation linked to the loan.
- **One active loan per bike.** Finalising a contract checks this.
- **Dates** are stored as ISO strings and shown as `DD.MM.YYYY`. Date and time fields are text inputs (`TT.MM.JJJJ`, `HH:MM`) parsed on the server, because `<input type="date">` follows the browser locale.
- **Drafts:** the contract wizard autosaves as a draft (debounced, and immediately when the tab is hidden). "Abschließen" sets the loan `active`; the return protocol sets it `returned`.
- **Rate limits** (in memory, per process): 10 login attempts per e-mail and 30 per IP in 10 minutes; 10 messages a minute and 120 an hour per member.
- **Notifications:** none yet. `notifyNewMessage()` in `src/lib/notify.ts` is the hook for e-mail or push later.

Astro's action body limit is raised to 80 MB (`astro.config.mjs`) so phones without JS can upload full-size photos; with JS, photos are shrunk before upload.
