# Prompt: Kickstand auf Vercel + Turso + Vercel Blob bringen

Same setup as `Flor del Pato`, which already runs this way:
- Vercel team `icanspeak`
- Turso org `edstar3000` in AWS EU West / Ireland
- Vercel Blob
- `@astrojs/vercel`

You are working in this repo:
- Astro 5, SSR, `@astrojs/node`
- Drizzle + `@libsql/client` (already async)
- Better Auth (Google + email)
- a `StorageAdapter` in `src/lib/storage`

Read `README.md`, `docs/DECISIONS.md`, `docs/MIGRATION-GOOGLE.md`, `src/lib/data/*`, `src/lib/storage/*` and `src/lib/auth/*` first.

**Goal:** the prototype runs on Vercel and all data survives redeploys:
- **Database:** Turso
- **Photos:** Vercel Blob
- **Local:** local development keeps working with **no accounts and no env vars**, using a local libSQL file and uploads on disk.

Behaviour, UI and tests stay the same. This is an infrastructure change only. The later move to Google stays possible: only the adapters change.

---

## 1. Adapter
- Replace `@astrojs/node` with **`@astrojs/vercel`**, `output: "server"`, `maxDuration: 30`.
- Set the function region to **`dub1`** in `vercel.json`, next to the Turso DB in eu-west-1.
- Images:
  - `imageService: true` and `devImageService: "sharp"`
  - `remotePatterns` for `**.public.blob.vercel-storage.com`

  Same as Flor del Pato's `astro.config.mjs`.
- `site` comes from `PUBLIC_SITE_URL`, falling back to `https://${VERCEL_PROJECT_PRODUCTION_URL}`. `security.checkOrigin` must keep working behind Vercel's proxy, and Better Auth's base URL must match.
- **Caching:**
  - The landing page `/` and `/so-gehts`: `Cache-Control: s-maxage=60, stale-while-revalidate=600`. The board preview reads the DB, so it's not prerendered.
  - **No caching** on `/anzeigen*`, `/nachrichten*`, `/merkliste`, `/profil`, `/app/*`, `/login`, `/registrieren` and `/api/*`.
- Remove the Dockerfile and compose file, or move them to `docs/self-hosting/` with a note. Vercel is now the default.

## 2. Database → Turso
- `src/lib/db`: one module-level `createClient({ url: TURSO_DATABASE_URL ?? "file:./data/kickstand.db", authToken: TURSO_AUTH_TOKEN })`.
- `drizzle.config.ts`: `dialect: "turso"` with the same env vars.
- **Migrations:**
  - Never auto-migrate on cold start in production.
  - Add `npm run db:migrate -- --remote` and `npm run db:seed -- --remote`, which read the Turso values from `.env`.
  - `npm run dev` always uses the local file.
  - Seeding or resetting a remote DB asks for confirmation, or needs `--yes`.
- Better Auth uses the same DB via the drizzle adapter (already the case). Check that its tables are in the migrations.

## 3. Uploads → Vercel Blob
Add `VercelBlobStorage` to `src/lib/storage` next to `LocalDiskStorage`. Use it automatically when `BLOB_READ_WRITE_TOKEN` is set.

- **Listing photos** (public):
  - `put("listings/<random>.webp", buf, { access: "public", contentType: "image/webp" })`
  - store the URL
  - render them via `astro:assets` / the Vercel image service
- **Loan photos** (private: they show the borrower's bike and damages):
  - If the installed `@vercel/blob` supports `access: "private"`, use it.
  - Otherwise store them public under a **random 32-byte key** and **never** put the Blob URL into HTML. Always stream them through the existing access-checked `/media/...` endpoint, which checks lender or borrower first.
  - Write the choice into `docs/DECISIONS.md`.
- **Signatures:** stay in the DB as today. If they're files, treat them like loan photos.
- **Delete:** deleting a listing photo or listing deletes the blob (`del(url)`).
- **No production writes to disk:** search for `fs.` and guard or remove every production path.
- Keep `sharp` re-encoding (max 1600 px, WebP, strip metadata).

## 4. Serverless details
- **Rate limiting:** it's in-memory, so it's per instance. Fine for the prototype; note it in the README and DECISIONS. Later: Upstash or the Vercel firewall.
- **Cookies:** `Secure` in production.
- **Google OAuth:** add the redirect URIs `https://<vercel-domain>/api/auth/callback/google` and the preview pattern if possible. Document this in the README.
- **Time limits:** nothing runs longer than a few seconds. Seed and reset run in batches.
- **Message polling:** the 15 s poll stays. Make sure the endpoint is cheap (one indexed query) and uncached.

## 5. Environment variables
Update `.env.example` and the README:

| Variable | Local | Vercel (Production + Preview) |
|---|---|---|
| `TURSO_DATABASE_URL` | `file:./data/kickstand.db` (default) | `libsql://kickstand-edstar3000.aws-eu-west-1.turso.io` |
| `TURSO_AUTH_TOKEN` | – | Turso read & write token |
| `BLOB_READ_WRITE_TOKEN` | – (uploads to disk) | added automatically when the Blob store is connected |
| `BETTER_AUTH_SECRET` | any string | `openssl rand -hex 32` |
| `PUBLIC_SITE_URL` | `http://localhost:4321` | the Vercel URL, later the custom domain |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | from Google Cloud Console |
| `SHOW_DEMO_LOGINS` | `true` | `true` for the demo, `false` later |

Never commit tokens. `.env*` (except `.env.example`) goes in `.gitignore`.

## 6. Deploy steps (write into the README as "Deploying to Vercel")
1. **Git:** `git init`, first commit. The repo has no git yet.
2. **Turso:**
   - `turso db create kickstand --location aws-eu-west-1` (org `edstar3000`)
   - `turso db show kickstand --url`
   - `turso db tokens create kickstand`
   - Put both values into `.env`.
3. **Migrate and seed:** `npm run db:migrate -- --remote`, then `npm run db:seed -- --remote` (once, demo data).
4. **Link:** `vercel link --scope icanspeak`, project name `kickstand`. Then add the env vars with `vercel env add … production` (and `preview`).
5. **Blob:** in the Vercel dashboard (team icanspeak), go to **Storage → Create → Blob** and connect it to `kickstand`. This adds `BLOB_READ_WRITE_TOKEN`.
6. **Google OAuth:** add the Vercel URL to the Google OAuth client.
7. **Deploy:** `vercel --prod`. CLI deploys are the default, as in Flor del Pato; Git-based deploys are optional.
8. **Later schema changes:** `npm run db:generate` → `npm run db:migrate -- --remote` → deploy.

## 7. Done when
- `npm test` and `npm run check` pass. `npm run dev` works with no env vars at all.
- On the Vercel deployment, all of these work and **still exist after a redeploy**:
  1. register with email, and log in with Google if configured
  2. create a listing with a photo and see it on `/anzeigen`
  3. message the owner
  4. start a Leihvertrag from the conversation, add a handover photo and both signatures, then download the PDF
- A loan photo URL can't be opened by a third logged-in user or by a logged-out visitor.
- README, `.env.example`, `docs/DECISIONS.md` and `docs/MIGRATION-GOOGLE.md` are updated. MIGRATION-GOOGLE gets one paragraph: "from Vercel/Turso/Blob to Google".

Work in small commits: adapter → DB → storage → docs. If something is unclear, pick the simplest option that keeps local dev account-free and write it down in `docs/DECISIONS.md`.
