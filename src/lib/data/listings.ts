// Anzeigen: create, edit, search, photos. The marketplace rules live here so every caller gets them.
import { and, asc, count, desc, eq, inArray, max, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { Bike, Category, Listing, ListingPhoto, User } from "../../db/schema";
import { lentBikeIds } from "./bikes";
import { tk } from "../../i18n";
import { badRequest, newId, notFound } from "./errors";
import type { Listing as ListingRecord } from "./types";

export const LISTING_TYPES = ["biete", "suche"] as const;
export const PRICE_KINDS = ["kostenlos", "tausch", "preis", "vb"] as const;
export const LISTING_STATUSES = ["aktiv", "reserviert", "erledigt"] as const;
export const BIKE_CATEGORY = "motorrad-leihen";
export const MAX_PHOTOS = 8;
export const PAGE_SIZE = 20;

export type ListingType = (typeof LISTING_TYPES)[number];
export type PriceKind = (typeof PRICE_KINDS)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface CategoryRecord {
  slug: string;
  label: string;
  sort: number;
}

export interface ListingInput {
  type: string;
  categorySlug: string;
  title: string;
  description: string;
  priceKind: string;
  priceCents: number | null;
  zip: string;
  city: string;
  country: string;
  bikeId: string | null;
}

/** What a search result card needs. */
export interface ListingCard {
  id: string;
  userId: string;
  type: ListingType;
  categorySlug: string;
  categoryLabel: string;
  title: string;
  priceKind: PriceKind;
  priceCents: number | null;
  zip: string;
  city: string;
  country: string;
  status: ListingStatus;
  bikeId: string | null;
  createdAt: Date;
  coverPhotoId: string | null;
  /** A bike listing whose bike is lent out right now. */
  lent: boolean;
}

export interface ListingPhotoRecord {
  id: string;
  listingId: string;
  key: string;
  sort: number;
}

export interface ListingDetail extends ListingCard {
  description: string;
  updatedAt: Date;
  photos: ListingPhotoRecord[];
  seller: { id: string; name: string; memberSince: Date };
  bike: typeof Bike.$inferSelect | null;
}

export interface SearchFilters {
  q?: string;
  type?: string;
  category?: string;
  ort?: string;
  page?: number;
}

export interface SearchResult {
  items: ListingCard[];
  total: number;
  page: number;
  pageCount: number;
}

// --- Categories ---

export async function listCategories(): Promise<CategoryRecord[]> {
  return db.select().from(Category).orderBy(asc(Category.sort));
}

export async function getCategory(slug: string): Promise<CategoryRecord | null> {
  const [c] = await db.select().from(Category).where(eq(Category.slug, slug));
  return c ?? null;
}

// --- Validation ---

const isOneOf = <T extends readonly string[]>(list: T, v: string): v is T[number] => (list as readonly string[]).includes(v);

/**
 * Applies the listing rules and returns the values to store. Throws a German BAD_REQUEST message on the first problem.
 * - A bike offer ("motorrad-leihen" + "biete") must link one of the user's own bikes and is always free.
 * - Other listings never link a bike.
 */
export async function checkListingInput(userId: string, input: ListingInput) {
  if (!isOneOf(LISTING_TYPES, input.type)) badRequest(tk("Bitte Biete oder Suche wählen."));
  const category = await getCategory(input.categorySlug);
  if (!category) badRequest(tk("Bitte eine Kategorie wählen."));
  const title = input.title.trim();
  if (title.length < 3) badRequest(tk("Bitte einen Titel angeben."));
  const city = input.city.trim();
  const zip = input.zip.trim();
  if (!city && !zip) badRequest(tk("Bitte Ort oder PLZ angeben."));

  const isBikeOffer = category.slug === BIKE_CATEGORY && input.type === "biete";
  let bikeId: string | null = null;
  let priceKind = input.priceKind;
  let priceCents = input.priceCents;

  if (isBikeOffer) {
    if (!input.bikeId) badRequest(tk("Für „Motorrad zum Leihen“ bitte eins deiner Motorräder wählen."));
    const [bike] = await db.select().from(Bike).where(and(eq(Bike.id, input.bikeId), eq(Bike.ownerId, userId)));
    if (!bike) badRequest(tk("Für „Motorrad zum Leihen“ bitte eins deiner Motorräder wählen."));
    bikeId = bike.id;
    // Kickstand only does free loans (Leihe nach § 598 BGB).
    priceKind = "kostenlos";
    priceCents = null;
  } else {
    if (!isOneOf(PRICE_KINDS, priceKind)) badRequest(tk("Bitte eine Preisart wählen."));
    if (priceKind === "preis" && (priceCents == null || priceCents <= 0)) badRequest(tk("Bitte einen Preis angeben."));
    if (priceKind === "kostenlos" || priceKind === "tausch") priceCents = null;
    if (priceCents != null && (priceCents < 0 || priceCents > 100_000_00)) badRequest(tk("Der Preis muss zwischen 0 und 100.000 € liegen."));
  }

  const description = input.description.trim().slice(0, 4000);
  return {
    type: input.type,
    categorySlug: category.slug,
    title: title.slice(0, 120),
    description,
    searchText: searchKey(`${title} ${description}`),
    cityKey: searchKey(city),
    priceKind,
    priceCents,
    zip: zip.slice(0, 10),
    city: city.slice(0, 80),
    country: /^[A-Z]{2}$/.test(input.country) ? input.country : "DE",
    bikeId,
  };
}

// --- Writes ---

export async function createListing(userId: string, input: ListingInput): Promise<string> {
  const values = await checkListingInput(userId, input);
  const id = newId();
  await db.insert(Listing).values({ id, userId, status: "aktiv", ...values });
  return id;
}

/** The listing, only for its owner. */
export async function getOwnListing(listingId: string, userId: string): Promise<ListingRecord | null> {
  const [l] = await db.select().from(Listing).where(and(eq(Listing.id, listingId), eq(Listing.userId, userId)));
  return l ?? null;
}

async function requireOwnListing(listingId: string, userId: string): Promise<ListingRecord> {
  const l = await getOwnListing(listingId, userId);
  if (!l) notFound(tk("Anzeige nicht gefunden."));
  return l;
}

/** Only the owner can edit. Anyone else gets NOT_FOUND, so ids of other people's listings reveal nothing. */
export async function updateListing(userId: string, listingId: string, input: ListingInput): Promise<void> {
  const existing = await requireOwnListing(listingId, userId);
  const values = await checkListingInput(userId, input);
  await db
    .update(Listing)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(Listing.id, existing.id));
}

export async function setListingStatus(userId: string, listingId: string, status: string): Promise<void> {
  const existing = await requireOwnListing(listingId, userId);
  if (!isOneOf(LISTING_STATUSES, status)) badRequest(tk("Unbekannter Status."));
  await db.update(Listing).set({ status, updatedAt: new Date() }).where(eq(Listing.id, existing.id));
}

/** Deletes the listing (photos, saves and conversations cascade). Returns the photo keys so the caller can remove the files. */
export async function deleteListing(userId: string, listingId: string): Promise<string[]> {
  const existing = await requireOwnListing(listingId, userId);
  const photos = await db.select().from(ListingPhoto).where(eq(ListingPhoto.listingId, existing.id));
  await db.delete(Listing).where(eq(Listing.id, existing.id));
  return photos.map((p) => p.key);
}

// --- Photos ---

export async function listListingPhotos(listingId: string): Promise<ListingPhotoRecord[]> {
  return db.select().from(ListingPhoto).where(eq(ListingPhoto.listingId, listingId)).orderBy(asc(ListingPhoto.sort), asc(ListingPhoto.id));
}

export async function countListingPhotos(listingId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(ListingPhoto).where(eq(ListingPhoto.listingId, listingId));
  return r?.n ?? 0;
}

/** Checks the owner and the photo limit before an upload. */
export async function assertCanAddPhoto(userId: string, listingId: string): Promise<void> {
  await requireOwnListing(listingId, userId);
  if ((await countListingPhotos(listingId)) >= MAX_PHOTOS) badRequest(tk("Höchstens 8 Fotos pro Anzeige.")) // MAX_PHOTOS is 8; a fixed sentence so it can be translated;
}

export async function addListingPhoto(userId: string, listingId: string, key: string): Promise<string> {
  await assertCanAddPhoto(userId, listingId);
  const [r] = await db.select({ top: max(ListingPhoto.sort) }).from(ListingPhoto).where(eq(ListingPhoto.listingId, listingId));
  const id = newId();
  await db.insert(ListingPhoto).values({ id, listingId, key, sort: (r?.top ?? -1) + 1 });
  return id;
}

export async function getListingPhoto(photoId: string): Promise<ListingPhotoRecord | null> {
  const [p] = await db.select().from(ListingPhoto).where(eq(ListingPhoto.id, photoId));
  return p ?? null;
}

async function requireOwnPhoto(userId: string, photoId: string): Promise<ListingPhotoRecord> {
  const p = await getListingPhoto(photoId);
  if (!p || !(await getOwnListing(p.listingId, userId))) notFound(tk("Foto nicht gefunden."));
  return p;
}

/** Removes a photo row; returns its storage key. */
export async function removeListingPhoto(userId: string, photoId: string): Promise<string> {
  const p = await requireOwnPhoto(userId, photoId);
  await db.delete(ListingPhoto).where(eq(ListingPhoto.id, p.id));
  return p.key;
}

/** Makes a photo the cover (first). */
export async function makeCoverPhoto(userId: string, photoId: string): Promise<void> {
  const p = await requireOwnPhoto(userId, photoId);
  const photos = await listListingPhotos(p.listingId);
  const order = [p, ...photos.filter((x) => x.id !== p.id)];
  for (const [i, x] of order.entries()) {
    if (x.sort !== i) await db.update(ListingPhoto).set({ sort: i }).where(eq(ListingPhoto.id, x.id));
  }
}

// --- Reads ---

const cardColumns = {
  id: Listing.id,
  userId: Listing.userId,
  type: Listing.type,
  categorySlug: Listing.categorySlug,
  categoryLabel: Category.label,
  title: Listing.title,
  priceKind: Listing.priceKind,
  priceCents: Listing.priceCents,
  zip: Listing.zip,
  city: Listing.city,
  country: Listing.country,
  status: Listing.status,
  bikeId: Listing.bikeId,
  createdAt: Listing.createdAt,
};

type CardRow = Omit<ListingCard, "coverPhotoId" | "lent" | "type" | "priceKind" | "status"> & { type: string; priceKind: string; status: string };

/** Adds cover photo and the "verliehen" flag to plain rows. */
async function toCards(rows: CardRow[]): Promise<ListingCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const photos = await db
    .select({ id: ListingPhoto.id, listingId: ListingPhoto.listingId, sort: ListingPhoto.sort })
    .from(ListingPhoto)
    .where(inArray(ListingPhoto.listingId, ids))
    .orderBy(asc(ListingPhoto.sort), asc(ListingPhoto.id));
  const cover = new Map<string, string>();
  for (const p of photos) if (!cover.has(p.listingId)) cover.set(p.listingId, p.id);
  const lent = await lentBikeIds(rows.map((r) => r.bikeId ?? ""));
  return rows.map((r) => ({
    ...r,
    type: r.type as ListingType,
    priceKind: r.priceKind as PriceKind,
    status: r.status as ListingStatus,
    coverPhotoId: cover.get(r.id) ?? null,
    lent: !!r.bikeId && lent.has(r.bikeId),
  }));
}

/** Lowercase, collapsed whitespace. Full Unicode case folding, so "ÜBER" finds "Überlingen". */
export function searchKey(v: string): string {
  return v.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
}

/** Escapes LIKE wildcards; used with ESCAPE '\'. */
function likeEscape(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Patterns are matched against the stored lowercase keys, so plain LIKE is enough (and case-sensitive on Postgres too).
const like = (column: AnyColumn, pattern: string) => sql`${column} like ${pattern} escape '\\'`;

/** Builds the WHERE clause for the public search. Only active listings are ever found. */
export function searchConditions(f: SearchFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [eq(Listing.status, "aktiv")];
  if (f.type && isOneOf(LISTING_TYPES, f.type)) conds.push(eq(Listing.type, f.type));
  if (f.category) conds.push(eq(Listing.categorySlug, f.category));
  const q = searchKey(f.q ?? "").slice(0, 100);
  if (q) {
    // Every word must appear in the title or the description.
    for (const word of q.split(" ").slice(0, 6)) conds.push(like(Listing.searchText, `%${likeEscape(word)}%`));
  }
  const ort = searchKey(f.ort ?? "").slice(0, 80);
  if (ort) {
    const p = `${likeEscape(ort)}%`;
    conds.push(or(like(Listing.cityKey, p), like(Listing.zip, p)));
  }
  return and(...conds);
}

export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  const where = searchConditions(f);
  const [{ n }] = await db.select({ n: count() }).from(Listing).where(where);
  const pageCount = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(f.page ?? 1)), pageCount);
  const rows = await db
    .select(cardColumns)
    .from(Listing)
    .innerJoin(Category, eq(Category.slug, Listing.categorySlug))
    .where(where)
    .orderBy(desc(Listing.createdAt), desc(Listing.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items: await toCards(rows), total: n, page, pageCount };
}

export async function latestListings(limit = 6): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns)
    .from(Listing)
    .innerJoin(Category, eq(Category.slug, Listing.categorySlug))
    .where(eq(Listing.status, "aktiv"))
    .orderBy(desc(Listing.createdAt), desc(Listing.id))
    .limit(limit);
  return toCards(rows);
}

/** All of the user's listings, any status. */
export async function listOwnListings(userId: string): Promise<ListingCard[]> {
  const rows = await db
    .select(cardColumns)
    .from(Listing)
    .innerJoin(Category, eq(Category.slug, Listing.categorySlug))
    .where(eq(Listing.userId, userId))
    .orderBy(desc(Listing.createdAt));
  return toCards(rows);
}

export async function listingCardsByIds(ids: string[]): Promise<ListingCard[]> {
  if (!ids.length) return [];
  const rows = await db
    .select(cardColumns)
    .from(Listing)
    .innerJoin(Category, eq(Category.slug, Listing.categorySlug))
    .where(inArray(Listing.id, ids));
  const cards = await toCards(rows);
  const order = new Map(ids.map((id, i) => [id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** A bike listing for this bike, if the owner has one (to link "Leihvertrag starten" from the bike). */
export async function listingForBike(bikeId: string, userId: string): Promise<ListingRecord | null> {
  const [l] = await db
    .select()
    .from(Listing)
    .where(and(eq(Listing.bikeId, bikeId), eq(Listing.userId, userId)))
    .orderBy(desc(Listing.createdAt))
    .limit(1);
  return l ?? null;
}

/**
 * Full listing for the detail page. Listings that are not active are only shown to their owner
 * (and to members who already have a conversation about them, handled by the caller).
 */
export async function getListingDetail(listingId: string): Promise<ListingDetail | null> {
  const [row] = await db
    .select({ ...cardColumns, description: Listing.description, updatedAt: Listing.updatedAt, sellerName: User.name, memberSince: User.createdAt })
    .from(Listing)
    .innerJoin(Category, eq(Category.slug, Listing.categorySlug))
    .innerJoin(User, eq(User.id, Listing.userId))
    .where(eq(Listing.id, listingId));
  if (!row) return null;
  const { sellerName, memberSince, description, updatedAt, ...card } = row;
  const [c] = await toCards([card]);
  const photos = await listListingPhotos(listingId);
  const bike = card.bikeId ? ((await db.select().from(Bike).where(eq(Bike.id, card.bikeId)))[0] ?? null) : null;
  return { ...c, description, updatedAt, photos, seller: { id: card.userId, name: sellerName, memberSince }, bike };
}
