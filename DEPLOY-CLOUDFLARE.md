# Prompt: Kickstand auf Cloudflare Workers + Turso + R2 bringen

The Vercel free plan limit is reached, so Kickstand moves to **Cloudflare Workers** on Edgar's **paid** Cloudflare account (Workers Paid, so the 10 ms CPU limit of the free plan does not apply).

You are working in this repo:
- Astro 5, SSR
- Drizzle + `@libsql/client` (async)
- Better Auth (Google + email)
- a `StorageAdapter` in `src/lib/storage`
- It may already be on `@astrojs/vercel` + Vercel Blob (from `DEPLOY-VERCEL.md`), or still on `@astrojs/node`. There may also be earlier Cloudflare attempts (`astro.config.cloudflare.mjs`, `wrangler.jsonc`, `.dev.vars`). Check `package.json`, both Astro configs and `wrangler.jsonc`, reuse what fits and end up with **one** `astro.config.mjs`.

Read `README.md`, `docs/DECISIONS.md`, `docs/MIGRATION-GOOGLE.md`, `astro.config.mjs`, `src/lib/data/*`, `src/lib/storage/*`, `src/lib/auth/*` and `src/lib/contract-pdf.ts` first.

**Goal:** the prototype runs on Cloudflare Workers and all data survives redeploys:
- **Database:** Turso (unchanged)
- **Photos:** Cloudflare R2
- **Local:** `npm run dev` keeps working with **no accounts and no env vars**, using a local libSQL file and uploads on disk.

Behaviour, UI and tests stay the same. This is an infrastructure change only, with one exception: the branding text fix in section 8. The later move to Google stays possible: only the adapters change.

---

## 1. Adapter
- Replace `@astrojs/vercel` (or `@astrojs/node`) with **`@astrojs/cloudflare`**, `output: "server"`. Remove `vercel.json` and `@vercel/*` packages.
- **`wrangler.jsonc`**:
  - `name: "kickstand"`, a current `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`
  - the assets setup the adapter docs require
  - R2 bindings `PUBLIC_MEDIA` and `PRIVATE_MEDIA` (see section 3)
  - rate-limit bindings (see section 4)
  - `observability: { enabled: true }`
  - **`placement: { mode: "smart" }`**: Turso sits in AWS eu-west-1, and one page does several DB queries. Smart placement runs the Worker near the DB instead of near the visitor.
- **Images:** `sharp` does not run in Workers.
  - Use the adapter's `imageService: "compile"` so the static brand images (`rider.jpg`, `myanmar.jpg`) are optimised at build time.
  - Listing photos are served as stored (already WebP/JPEG), no runtime transforms.
  - Cloudflare Images transformations are a possible later upgrade; note it in DECISIONS, don't build it.
- **Env access:** bindings and secrets only exist at request time. Pick one way (`Astro.locals.runtime.env` or `import { env } from "cloudflare:workers"`), use it in a single place (`src/lib/env.ts`) and make the DB client, storage and auth read from there lazily. No module-level code that reads `process.env` at import time in the Worker path.
- `site` comes from `PUBLIC_SITE_URL`. `security.checkOrigin` and Better Auth's base URL must match it.
- **Caching:** set `Cache-Control: s-maxage=60, stale-while-revalidate=600` on `/` and `/so-gehts` as before. **No caching** on `/anzeigen*`, `/nachrichten*`, `/merkliste`, `/profil`, `/app/*`, `/login`, `/registrieren` and `/api/*`. No extra Cache Rules or Cache API for now.
- Scripts:
  - `npm run dev`: `astro dev` with the local file + disk (no Wrangler needed)
  - `npm run preview`: build + `wrangler dev` (local R2 simulation, `.dev.vars`)
  - `npm run deploy`: build + `wrangler deploy`

## 2. Database: Turso stays
- `@libsql/client` with a `file:` URL needs a native binary that can't run in Workers. Choose the client by URL:
  - `file:` → the Node client (local dev only)
  - `libsql://` / `https://` → `@libsql/client/web`
- Make sure the Node/native client is **not bundled** into the Worker (dynamic import or alias). Check with `wrangler deploy --dry-run --outdir dist-check` and look for `libsql` native code or `fs` in the bundle.
- Migrations and seed stay as they are: `npm run db:migrate -- --remote`, `npm run db:seed -- --remote` (confirmation or `--yes`). Never migrate on request in production.
- Better Auth keeps using the same DB via the drizzle adapter.

## 3. Uploads → R2
Add `R2Storage` to `src/lib/storage` next to `LocalDiskStorage`. Use it automatically when the R2 bindings exist; otherwise fall back to disk. Remove `VercelBlobStorage` if it exists.

- **Two buckets:**
  - `kickstand-public`: listing photos, key `listings/<random>.webp|jpg`. Public access through a URL in `PUBLIC_MEDIA_URL` (r2.dev for the prototype, later `media.<domain>`). Store the key, build the URL from `PUBLIC_MEDIA_URL`.
  - `kickstand-private`: loan photos (they show the borrower's bike and damages), key with a **random 32-byte** part. **No public access, ever.** Always stream through the existing access-checked `/media/...` endpoint, which checks lender or borrower first.
- **Signatures:** stay in the DB as today. If they're files, treat them like loan photos.
- **Replacing `sharp`** (re-encode, max 1600 px, strip metadata):
  - With JS, `src/scripts/photos.ts` already shrinks and re-encodes in the browser, which also strips EXIF.
  - Without JS (no-JS forms are a requirement), the raw camera file arrives. On the server: accept only JPEG/WebP/PNG by magic bytes, reject files over a sensible limit (e.g. 8 MB) with a friendly error, and **strip EXIF/GPS** from JPEGs with a small pure-JS step before saving. Listing photos are public, so a GPS position in a photo is a privacy leak.
  - Pick the simplest library or code that works in Workers and write the choice into `docs/DECISIONS.md`.
- **Delete:** deleting a listing photo or listing deletes the R2 object.
- **Existing files:** if Vercel Blob (or disk in production) holds real user files, write a one-off script `scripts/copy-media-to-r2.ts` that copies them and rewrites the stored keys/URLs. Demo data can just be reseeded instead.
- **No production writes to disk:** search for `fs.` and guard or remove every production path.

## 4. Workers details
- **Rate limiting:** replace the in-memory limit with the Workers **Rate Limiting binding** for login and sending messages. Keep the in-memory version as the local fallback.
- **Cookies:** `Secure` in production.
- **Time zone:** Workers run in UTC. Check `src/lib/dates.ts`, relative dates ("vor 2 Tagen") and the contract PDF for anything that relies on the server's local time zone; format German dates with `Europe/Berlin` explicitly.
- **Contract PDF:** make sure `contract-pdf.ts` runs in workerd: no `fs` for fonts or templates (import them as assets/bytes), no Node-only APIs. Generate one PDF in `npm run preview` to prove it.
- **Google OAuth:** add the redirect URIs `https://kickstand.<account>.workers.dev/api/auth/callback/google` and, once there is one, the custom domain. Preview version URLs won't work for Google login; document that.
- **Message polling:** the 15 s poll stays. The endpoint must be one indexed query and uncached.

## 5. Environment variables
Update `.env.example`, add `.dev.vars.example`, and update the README:

| Name | Kind | Local (`npm run dev`) | Cloudflare |
|---|---|---|---|
| `TURSO_DATABASE_URL` | var | `file:./data/kickstand.db` (default) | `libsql://kickstand-edstar3000.aws-eu-west-1.turso.io` |
| `TURSO_AUTH_TOKEN` | secret | – | Turso read & write token |
| `BETTER_AUTH_SECRET` | secret | any string | `openssl rand -hex 32` |
| `PUBLIC_SITE_URL` | var | `http://localhost:4321` | the workers.dev URL, later the custom domain |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | secret | optional | from Google Cloud Console |
| `SHOW_DEMO_LOGINS` | var | `true` | `true` for the demo, `false` later |
| `PUBLIC_MEDIA_URL` | var | – (served from disk) | public URL of `kickstand-public` |
| `PUBLIC_MEDIA`, `PRIVATE_MEDIA` | R2 binding | – (disk) | the two buckets |

Plain vars go in `wrangler.jsonc` → `vars`, secrets via `wrangler secret put`. Never commit tokens. `.env*`, `.dev.vars` and `.wrangler/` (except the examples) go in `.gitignore`.

## 6. Deploy steps (write into the README as "Deploying to Cloudflare")
1. **Git:** commit the current state, then work on a branch `cloudflare`.
2. **Login:** `npx wrangler login` with Edgar's paid account. Check that **Workers Paid** is active (Workers & Pages → Plans), not only a website plan.
3. **Buckets:**
   - `npx wrangler r2 bucket create kickstand-public`
   - `npx wrangler r2 bucket create kickstand-private`
   - In the dashboard, turn on public access for `kickstand-public` only (r2.dev for now) and put that URL into `PUBLIC_MEDIA_URL`.
4. **Turso:** unchanged. If the DB doesn't exist yet, follow the Turso steps from `DEPLOY-VERCEL.md`, then migrate and seed with `--remote`.
5. **Secrets:** `npx wrangler secret put TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. **Deploy:** `npm run deploy`.
7. **Google OAuth:** add the workers.dev URL to the Google OAuth client.
8. **Custom domain (later):** if the domain is registered at Cloudflare, add it under Workers → kickstand → Settings → Domains & Routes. Then update `PUBLIC_SITE_URL`, the Google redirect URI, and optionally `media.<domain>` for the public bucket.
9. **Vercel:** don't delete the Vercel project. Edgar removes it himself once Cloudflare works.
10. **Later schema changes:** `npm run db:generate` → `npm run db:migrate -- --remote` → `npm run deploy`.

## 7. Done when
- `npm test` and `npm run check` pass. `npm run dev` works with no env vars at all. The dry-run bundle contains no native libSQL code and no `fs` writes.
- On the Cloudflare deployment, all of these work and **still exist after a redeploy**:
  1. register with email, and log in with Google if configured
  2. create a listing with a photo (with and without JS) and see it on `/anzeigen`; the stored photo has no GPS data
  3. message the owner
  4. start a Leihvertrag from the conversation, add a handover photo and both signatures, then download the PDF
- A loan photo URL can't be opened by a third logged-in user or by a logged-out visitor, and `kickstand-private` has no public URL.
- README, `.env.example`, `.dev.vars.example`, `docs/DECISIONS.md` and `docs/MIGRATION-GOOGLE.md` are updated. MIGRATION-GOOGLE gets one paragraph: "from Cloudflare/Turso/R2 to Google". Move Vercel-specific notes to `docs/self-hosting/vercel.md` or delete them.

## 8. Branding: Kickstand is not a Vlogato project
Kickstand only **borrows its look** from Edgar's travel blog vlogato.com (Design A: sky blue, the oval logo, the fonts). Vlogato is **not** an umbrella brand, a parent company or a sister project. Remove every claim that says otherwise; keep the visual design exactly as it is.

- `src/components/Logo.astro`: remove the byline "ein Projekt von Vlogato" and change the `aria-label` to "Kickstand. Zur Startseite". Close the gap the byline leaves so the header still looks balanced at 360px and 1280px.
- `src/layouts/Base.astro` (and any other footer): "Kickstand · Edgar Kretschmann" instead of "Kickstand · ein Projekt von Vlogato · Edgar Kretschmann".
- `src/pages/impressum.astro`: "Kickstand ist ein Projekt von Edgar Kretschmann."
- `README.md`: drop "a sister project of vlogato.com". If the design origin is worth a line, say "Design borrowed from vlogato.com".
- `src/pages/touren.astro` may keep linking to vlogato.com as Edgar's own blog; just don't present Kickstand as part of it.
- Code comments and the design name "Vlogato-Familie" in comments may stay (they describe where the look comes from).
- Afterwards `grep -rni vlogato src README.md` should only show `touren.astro` and comments.

Work in small commits: adapter → DB → storage → Workers details → branding text → docs. If something is unclear, pick the simplest option that keeps local dev account-free and write it down in `docs/DECISIONS.md`.
