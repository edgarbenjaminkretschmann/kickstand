# Moving the backend to Google

Phase 2 put all database, auth and file access behind three folders. Pages, actions, components and the middleware only call the plain functions exported there, so the move touches these folders and a few config files, not the UI.

| Layer | Files | Contract the rest of the app relies on |
|---|---|---|
| Data | `src/lib/data/listings.ts`, `conversations.ts`, `bikes.ts`, `loans.ts`, `profiles.ts`, `saved.ts` (+ `errors.ts`, `types.ts`), backed by `src/db/schema.ts` and `src/db/client.ts` | Async functions with plain return types (`ListingCard`, `ConversationView`, `Loan`, ...). Errors are `DataError` with `NOT_FOUND` / `BAD_REQUEST`. Access rules live inside these functions. |
| Auth | `src/lib/auth/index.ts`, `src/pages/api/auth/[...all].ts` | `getSession(headers)`, `getUser`, `requireUser`, `signInWithEmail`, `signUpWithEmail`, `startGoogleSignIn`, `signOut`, `googleEnabled`, `AuthUser` (`id`, `name`, `email`, `image`, `createdAt`), `AuthFailure` with German messages. |
| Storage | `src/lib/storage/index.ts` (`src/lib/uploads.ts` only does image processing) | `StorageAdapter` with `save(buffer, opts) → key`, `read(key)`, `delete(key)`; helpers `saveImage`, `readFileByKey`, `deleteFile`. Keys are relative paths like `listings/<id>/<photo>.jpg`. |

The access-checked media endpoints (`src/pages/media/*`) read through `readFileByKey` and stay as they are in both options.

Before either move: freeze writes (maintenance page), take a backup of `data/kickstand.db` and `uploads/`, and run `npm test` against the new backend before switching DNS.

---

## Option (a): Firebase Auth + Firestore + Cloud Storage

Everything Google-managed; the most code to change.

### Auth: `src/lib/auth/index.ts`: rewrite
- [ ] Replace Better Auth with the Firebase Admin SDK (`firebase-admin`) on the server and the Firebase JS SDK on `/login` and `/registrieren` for the Google popup/redirect and email + password.
- [ ] Session: after the client signs in, POST the ID token to a small endpoint that calls `auth.createSessionCookie()`; `getSession(headers)` verifies that cookie with `verifySessionCookie()` and maps the decoded token to `AuthUser` (keep the same fields).
- [ ] `signInWithEmail` / `signUpWithEmail` become client-side calls; keep the action names but have them only exchange the token, or move the forms to a small script (the no-JS path needs the Firebase REST API `accounts:signInWithPassword`, called server-side, to keep working without JS).
- [ ] Replace `src/pages/api/auth/[...all].ts` with the session-cookie endpoint and a logout endpoint.
- [ ] Profile creation on first login (today a Better Auth `databaseHooks.user.create`) moves into the session endpoint: call `ensureProfile()` when the user has no profile yet.
- [ ] Users: export with the Firebase Auth import tool. Better Auth password hashes (scrypt, in `Account.password`) are **not** importable as-is; plan a "set a new password" mail or Google-only login for existing members. Keep the user ids (`uid` = old `User.id`) so every foreign key still fits.
- [ ] Env: drop `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_*` (Google login is configured in the Firebase console); add `FIREBASE_PROJECT_ID` and a service account (`GOOGLE_APPLICATION_CREDENTIALS`).

### Data: `src/lib/data/*.ts`: rewrite the function bodies
- [ ] Delete `src/db/schema.ts`, `src/db/client.ts`, `drizzle/`, `drizzle.config.ts`, `scripts/migrate.mjs`. Add `src/lib/data/firestore.ts` with the Admin SDK client.
- [ ] Collections: `profiles/{userId}`, `bikes/{id}`, `listings/{id}` (photos as an array field, max 8), `users/{userId}/saved/{listingId}`, `conversations/{id}` with a `messages` subcollection, `loans/{id}` with `protocols`, `photos`, `signatures` subcollections, `categories/{slug}`.
- [ ] `listings.ts`: Firestore has no `LIKE`. Keep `searchText` and add a `searchWords: string[]` field (lowercased words of title + description) and query with `array-contains-any` for one word, filtering the rest in memory; Ort/PLZ prefix with `>=`/`<` range queries on `cityKey` / `zip`. Composite indexes: `status + createdAt`, `status + categorySlug + createdAt`, `status + type + createdAt`. Pagination with `startAfter` instead of `offset`. If search quality matters, add Algolia or Typesense instead.
- [ ] `conversations.ts`: `unreadTotal` and the unread counts become counters on the conversation document (`unreadFor.{userId}`), updated in a transaction in `sendMessage` / `markRead`.
- [ ] `loans.ts`: "one active loan per bike" needs a transaction (read active loans for the bike, then write).
- [ ] `bikes.ts`, `profiles.ts`, `saved.ts`: straightforward document reads/writes.
- [ ] Data move: a script reading the SQLite file through the current data layer and writing documents with the same ids.

### Storage: `src/lib/storage/index.ts`: implement one class
- [ ] Fill in `GoogleCloudStorage` with `firebase-admin/storage` (or `@google-cloud/storage`): `save` → `bucket.file(key).save(buffer, { contentType })`, `read` → `download()` (return null on 404), `delete` → `delete({ ignoreNotFound: true })`.
- [ ] Set `STORAGE_DRIVER=gcs` and `GCS_BUCKET=<bucket>`. Keep the bucket private; listing photos stay public through `/media/listing/*` (or switch those to signed URLs later).
- [ ] Copy `uploads/` with `gsutil -m rsync -r uploads gs://<bucket>`; keys stay the same.

### Stays the same
Pages, actions, components, `src/middleware.ts` (it only calls `getSession`), `contract-pdf.ts`, `euro-words.ts`, `dates.ts`, `src/lib/uploads.ts`, all scripts in `src/scripts/`.

---

## Option (b): Better Auth + Cloud SQL Postgres + Cloud Storage

Keeps the code shape; mostly configuration. Recommended unless there is a reason to want Firebase.

### Data: `src/db/*` and the drizzle setup change, `src/lib/data/*.ts` stays
- [ ] `src/db/schema.ts`: switch the imports from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core` (`sqliteTable` → `pgTable`, `integer(..., { mode: "timestamp_ms" })` → `timestamp(..., { withTimezone: true, mode: "date" })`, `integer(..., { mode: "boolean" })` → `boolean`, `text(..., { mode: "json" })` → `jsonb`). Table and column names stay; defaults are already set in JS, not SQL.
- [ ] `src/db/client.ts`: `drizzle-orm/node-postgres` with `pg` (or `postgres-js`), connecting through the Cloud SQL Auth Proxy or the Cloud SQL Node connector. `DATABASE_URL=postgres://...`.
- [ ] `drizzle.config.ts`: `dialect: "postgresql"`. Delete `drizzle/` and run `npm run db:generate` once to create a fresh Postgres baseline (copy the category inserts from `drizzle/0001_categories.sql` into a new migration).
- [ ] `scripts/migrate.mjs`: use `drizzle-orm/node-postgres/migrator`. `scripts/reset.mjs` only makes sense for SQLite; drop it or make it `DROP SCHEMA`.
- [ ] `src/lib/data/*.ts`: no changes expected. Search already matches lowercased `searchText` / `cityKey` with `LIKE ... ESCAPE '\'`, which works the same on Postgres (add a `pg_trgm` GIN index on `searchText` if it gets slow). `onConflictDoNothing` / `onConflictDoUpdate` exist in the pg dialect too.
- [ ] Data move: `pgloader` from the SQLite file, or a small script that reads every table with the libSQL client and inserts with the pg client (timestamps are epoch ms in SQLite → `new Date(ms)`).
- [ ] `tests/helpers/db.ts`: run tests against a throwaway Postgres (Docker) or PGlite instead of `:memory:` SQLite.

### Auth: `src/lib/auth/index.ts`: one line
- [ ] `drizzleAdapter(db, { provider: "pg", ... })`. Everything else, including Google login and existing password hashes, carries over unchanged.

### Storage: `src/lib/storage/index.ts`: implement one class
- [ ] Same as option (a): fill in `GoogleCloudStorage` with `@google-cloud/storage`, set `STORAGE_DRIVER=gcs`, `GCS_BUCKET`, copy `uploads/` with `gsutil rsync`.

### Runtime
- [ ] Cloud Run with the existing Dockerfile (it already runs migrations on start; with several instances, run migrations as a separate Cloud Run job instead).
- [ ] The in-memory rate limiter (`src/lib/rate-limit.ts`) is per instance; with more than one instance move it to Memorystore/Redis or a Postgres table.
- [ ] Secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, DB password) in Secret Manager.

### Stays the same
Everything outside `src/db/`, `src/lib/storage/index.ts`, one line of `src/lib/auth/index.ts`, `drizzle.config.ts` and the migration scripts.
