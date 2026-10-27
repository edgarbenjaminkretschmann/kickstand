// One-off: copies a Phase 1 Astro DB database into the new Drizzle schema and turns board posts and
// loan requests into listings and conversations. Run `npm run db:migrate` on the target first.
//
//   LEGACY_DATABASE_URL=file:./data/astro-db-legacy.db DATABASE_URL=file:./data/kickstand.db npm run db:migrate-legacy
//
// Safe to run twice: every row gets a deterministic id and existing rows are left alone.
// What maps where (details in docs/DECISIONS.md):
// - BoardPost -> listing (garage -> garage, tools -> werkzeug, help_offered/help_wanted -> hilfe biete/suche).
//   `active = false` becomes `erledigt`. The free-text `contact` field is dropped; people now write via Nachrichten.
// - Every lendable bike and every bike with requests -> one "motorrad-leihen" / "biete" listing (free).
// - LoanRequest -> a conversation between requester and owner about that listing, with the request as first message.
// - Loan.requestId -> Loan.listingId + Loan.conversationId, so the borrower keeps access to the contract.
import { createClient, type Row } from "@libsql/client";
import { eq } from "drizzle-orm";
import { databaseUrl, db } from "../src/db/client";
import { CATEGORIES } from "../src/db/categories";
import {
  Account,
  Bike,
  Category,
  Conversation,
  Listing,
  Loan,
  Message,
  Photo,
  Profile,
  Protocol,
  Session,
  Signature,
  User,
  Verification,
} from "../src/db/schema";
import { searchKey } from "../src/lib/data/listings";
import { formatDate } from "../src/lib/dates";

const legacyUrl = process.env.LEGACY_DATABASE_URL || "file:./data/astro-db-legacy.db";
const legacy = createClient({ url: legacyUrl, authToken: process.env.LEGACY_DATABASE_AUTH_TOKEN || undefined });
console.log(`Copying ${legacyUrl.replace(/\?.*$/, "")} into ${databaseUrl().replace(/\?.*$/, "")}`);

async function rows(table: string): Promise<Row[]> {
  const exists = await legacy.execute({ sql: "select 1 from sqlite_master where type = 'table' and name = ?", args: [table] });
  if (!exists.rows.length) return [];
  return (await legacy.execute(`select * from "${table}"`)).rows;
}

// Astro DB wrote "2026-10-23 19:31:59" (UTC, from CURRENT_TIMESTAMP) or full ISO strings.
function toDate(v: unknown): Date {
  if (v == null || v === "") return new Date();
  if (typeof v === "number") return new Date(v);
  const s = String(v);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
const toDateOrNull = (v: unknown) => (v == null || v === "" ? null : toDate(v));
const str = (v: unknown) => (v == null ? "" : String(v));
const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const bool = (v: unknown) => v === 1 || v === true || v === "1" || v === "true";

const counts: Record<string, number> = {};
async function put(name: string, insert: () => Promise<{ rowsAffected: number }>) {
  const r = await insert();
  counts[name] = (counts[name] ?? 0) + r.rowsAffected;
}

for (const c of CATEGORIES) await db.insert(Category).values(c).onConflictDoNothing();

// --- Members, sessions, bikes: same ids, dates converted ---

for (const u of await rows("User")) {
  await put("User", () =>
    db
      .insert(User)
      .values({
        id: str(u.id),
        name: str(u.name),
        email: str(u.email).toLowerCase(),
        emailVerified: bool(u.emailVerified),
        image: strOrNull(u.image),
        createdAt: toDate(u.createdAt),
        updatedAt: toDate(u.updatedAt),
      })
      .onConflictDoNothing(),
  );
}

for (const a of await rows("Account")) {
  await put("Account", () =>
    db
      .insert(Account)
      .values({
        id: str(a.id),
        accountId: str(a.accountId),
        providerId: str(a.providerId),
        userId: str(a.userId),
        accessToken: strOrNull(a.accessToken),
        refreshToken: strOrNull(a.refreshToken),
        idToken: strOrNull(a.idToken),
        accessTokenExpiresAt: toDateOrNull(a.accessTokenExpiresAt),
        refreshTokenExpiresAt: toDateOrNull(a.refreshTokenExpiresAt),
        scope: strOrNull(a.scope),
        password: strOrNull(a.password),
        createdAt: toDate(a.createdAt),
        updatedAt: toDate(a.updatedAt),
      })
      .onConflictDoNothing(),
  );
}

const now = Date.now();
for (const s of await rows("Session")) {
  const expiresAt = toDate(s.expiresAt);
  if (expiresAt.getTime() <= now) continue;
  await put("Session", () =>
    db
      .insert(Session)
      .values({
        id: str(s.id),
        expiresAt,
        token: str(s.token),
        createdAt: toDate(s.createdAt),
        updatedAt: toDate(s.updatedAt),
        ipAddress: strOrNull(s.ipAddress),
        userAgent: strOrNull(s.userAgent),
        userId: str(s.userId),
      })
      .onConflictDoNothing(),
  );
}

for (const v of await rows("Verification")) {
  await put("Verification", () =>
    db
      .insert(Verification)
      .values({
        id: str(v.id),
        identifier: str(v.identifier),
        value: str(v.value),
        expiresAt: toDate(v.expiresAt),
        createdAt: toDate(v.createdAt),
        updatedAt: toDate(v.updatedAt),
      })
      .onConflictDoNothing(),
  );
}

const profiles = new Map<string, Row>();
for (const p of await rows("Profile")) {
  profiles.set(str(p.userId), p);
  await put("Profile", () =>
    db
      .insert(Profile)
      .values({
        userId: str(p.userId),
        name: str(p.name),
        street: str(p.street),
        zipCity: str(p.zipCity),
        phone: str(p.phone),
        birthdate: strOrNull(p.birthdate),
        licenseNumber: str(p.licenseNumber),
        licenseClassASince: str(p.licenseClassASince),
        city: str(p.city),
      })
      .onConflictDoNothing(),
  );
}

const bikes = await rows("Bike");
for (const b of bikes) {
  await put("Bike", () =>
    db
      .insert(Bike)
      .values({
        id: str(b.id),
        ownerId: str(b.ownerId),
        make: str(b.make),
        model: str(b.model),
        typeCode: str(b.typeCode),
        plate: str(b.plate),
        vin: str(b.vin),
        firstRegistration: strOrNull(b.firstRegistration),
        powerKw: num(b.powerKw),
        displacementCcm: num(b.displacementCcm),
        fuel: str(b.fuel),
        conditions: str(b.conditions),
        insurer: str(b.insurer),
        policyNumber: str(b.policyNumber),
        liabilityCapEur: num(b.liabilityCapEur) ?? 1000,
        photoPath: strOrNull(b.photoPath),
        lendable: bool(b.lendable),
        createdAt: toDate(b.createdAt),
      })
      .onConflictDoNothing(),
  );
}

// --- Board posts -> listings ---

const KIND: Record<string, { categorySlug: string; type: "biete" | "suche" }> = {
  garage: { categorySlug: "garage", type: "biete" },
  tools: { categorySlug: "werkzeug", type: "biete" },
  help_offered: { categorySlug: "hilfe", type: "biete" },
  help_wanted: { categorySlug: "hilfe", type: "suche" },
};

for (const p of await rows("BoardPost")) {
  const map = KIND[str(p.kind)] ?? { categorySlug: "sonstiges", type: "biete" as const };
  const title = str(p.title).slice(0, 120);
  const description = str(p.body).slice(0, 4000);
  const city = str(p.city);
  const createdAt = toDate(p.createdAt);
  await put("listing (board)", () =>
    db
      .insert(Listing)
      .values({
        id: `legacy_post_${str(p.id)}`,
        userId: str(p.userId),
        ...map,
        title,
        description,
        priceKind: "kostenlos",
        priceCents: null,
        city,
        country: "DE",
        status: bool(p.active) ? "aktiv" : "erledigt",
        searchText: searchKey(`${title} ${description}`),
        cityKey: searchKey(city),
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoNothing(),
  );
}

// --- Bikes and loan requests -> bike listings and conversations ---

const requests = await rows("LoanRequest");
const requestedBikes = new Set(requests.map((r) => str(r.bikeId)));
const bikeListing = new Map<string, string>();

for (const b of bikes) {
  const bikeId = str(b.id);
  if (!bool(b.lendable) && !requestedBikes.has(bikeId)) continue;
  const id = `legacy_bike_${bikeId}`;
  bikeListing.set(bikeId, id);
  const owner = profiles.get(str(b.ownerId));
  const zipCity = str(owner?.zipCity);
  const zip = /^\d{4,5}\b/.exec(zipCity)?.[0] ?? "";
  const city = str(owner?.city) || zipCity.replace(/^\d{4,5}\s*/, "");
  const title = `${str(b.make)} ${str(b.model)} zum Leihen`.slice(0, 120);
  const description = [str(b.conditions) && `Auflage: ${str(b.conditions)}`].filter(Boolean).join("\n");
  const createdAt = toDate(b.createdAt);
  await put("listing (bike)", () =>
    db
      .insert(Listing)
      .values({
        id,
        userId: str(b.ownerId),
        type: "biete",
        categorySlug: "motorrad-leihen",
        title,
        description,
        priceKind: "kostenlos",
        priceCents: null,
        zip,
        city,
        country: "DE",
        status: bool(b.lendable) ? "aktiv" : "erledigt",
        bikeId,
        searchText: searchKey(`${title} ${description}`),
        cityKey: searchKey(city),
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoNothing(),
  );
}

const STATUS_NOTE: Record<string, string> = { accepted: "angenommen", declined: "abgelehnt", withdrawn: "zurückgezogen" };
const requestConversation = new Map<string, { listingId: string; conversationId: string }>();
const bikeOwner = new Map(bikes.map((b) => [str(b.id), str(b.ownerId)]));

for (const r of [...requests].sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())) {
  const bikeId = str(r.bikeId);
  const listingId = bikeListing.get(bikeId);
  const sellerId = bikeOwner.get(bikeId);
  const buyerId = str(r.requesterId);
  if (!listingId || !sellerId || buyerId === sellerId) continue;
  // One conversation per listing and member, so several requests from the same person share it.
  const conversationId = `legacy_conv_${bikeId}_${buyerId}`;
  const createdAt = toDate(r.createdAt);
  await put("conversation", () =>
    db.insert(Conversation).values({ id: conversationId, listingId, buyerId, sellerId, createdAt, lastMessageAt: createdAt }).onConflictDoNothing(),
  );
  const status = STATUS_NOTE[str(r.status)];
  const body = [`Leihanfrage ab ${formatDate(str(r.desiredStart)) || str(r.desiredStart)}.`, str(r.message), status ? `(Anfrage ${status})` : ""]
    .filter(Boolean)
    .join("\n\n");
  await put("message", () =>
    db
      .insert(Message)
      .values({ id: `legacy_req_${str(r.id)}`, conversationId, senderId: buyerId, body, createdAt, readAt: createdAt })
      .onConflictDoNothing(),
  );
  await db.update(Conversation).set({ lastMessageAt: createdAt }).where(eq(Conversation.id, conversationId));
  requestConversation.set(str(r.id), { listingId, conversationId });
}

// --- Loans, protocols, photos, signatures ---

for (const l of await rows("Loan")) {
  const link = l.requestId ? requestConversation.get(str(l.requestId)) : undefined;
  let items = { keys: true, keyCount: 1, registration: true, other: "" };
  try {
    items = { ...items, ...JSON.parse(str(l.handedOverItems) || "{}") };
  } catch {
    // keep defaults
  }
  await put("Loan", () =>
    db
      .insert(Loan)
      .values({
        id: str(l.id),
        bikeId: str(l.bikeId),
        lenderId: str(l.lenderId),
        listingId: link?.listingId ?? bikeListing.get(str(l.bikeId)) ?? null,
        conversationId: link?.conversationId ?? null,
        status: str(l.status) || "draft",
        borrowerName: str(l.borrowerName),
        borrowerStreet: str(l.borrowerStreet),
        borrowerZipCity: str(l.borrowerZipCity),
        borrowerBirthdate: strOrNull(l.borrowerBirthdate),
        borrowerPhone: str(l.borrowerPhone),
        licenseNumber: str(l.licenseNumber),
        licenseClassASince: str(l.licenseClassASince),
        startDate: strOrNull(l.startDate),
        startTime: strOrNull(l.startTime),
        endMode: str(l.endMode) || "open",
        endDate: strOrNull(l.endDate),
        endTime: strOrNull(l.endTime),
        latestEndDate: strOrNull(l.latestEndDate),
        returnPlace: str(l.returnPlace),
        liabilityCapEur: num(l.liabilityCapEur) ?? 1000,
        handedOverItems: items,
        placeDate: str(l.placeDate),
        createdAt: toDate(l.createdAt),
      })
      .onConflictDoNothing(),
  );
}

for (const p of await rows("Protocol")) {
  await put("Protocol", () =>
    db
      .insert(Protocol)
      .values({
        id: str(p.id),
        loanId: str(p.loanId),
        kind: str(p.kind),
        datetime: strOrNull(p.datetime),
        odometerKm: num(p.odometerKm),
        fuelLevel: str(p.fuelLevel),
        damages: str(p.damages),
      })
      .onConflictDoNothing(),
  );
}

// Photo files stay where they are; the stored key is the same relative path under UPLOAD_DIR.
for (const p of await rows("Photo")) {
  await put("Photo", () =>
    db.insert(Photo).values({ id: str(p.id), protocolId: str(p.protocolId), path: str(p.path), takenAt: toDate(p.takenAt) }).onConflictDoNothing(),
  );
}

for (const s of await rows("Signature")) {
  await put("Signature", () =>
    db.insert(Signature).values({ id: str(s.id), loanId: str(s.loanId), role: str(s.role), pngDataUrl: str(s.pngDataUrl) }).onConflictDoNothing(),
  );
}

legacy.close();
console.log("Done:");
for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n} new`);
