// Merkliste: listings a member saved.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { Listing, SavedListing } from "../../db/schema";
import { notFound } from "./errors";
import { listingCardsByIds, type ListingCard } from "./listings";

export async function isSaved(userId: string, listingId: string): Promise<boolean> {
  const [r] = await db.select().from(SavedListing).where(and(eq(SavedListing.userId, userId), eq(SavedListing.listingId, listingId)));
  return !!r;
}

/** Which of these listings the user saved. */
export async function savedIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const rows = await db
    .select({ id: SavedListing.listingId })
    .from(SavedListing)
    .where(and(eq(SavedListing.userId, userId), inArray(SavedListing.listingId, listingIds)));
  return new Set(rows.map((r) => r.id));
}

/** Saves or unsaves. Returns whether the listing is saved afterwards. */
export async function setSaved(userId: string, listingId: string, saved: boolean): Promise<boolean> {
  const [l] = await db.select({ id: Listing.id }).from(Listing).where(eq(Listing.id, listingId));
  if (!l) notFound("Anzeige nicht gefunden.");
  if (saved) {
    await db.insert(SavedListing).values({ userId, listingId }).onConflictDoNothing();
  } else {
    await db.delete(SavedListing).where(and(eq(SavedListing.userId, userId), eq(SavedListing.listingId, listingId)));
  }
  return saved;
}

/** Saved listings, newest save first. Includes listings that are no longer active, so people see what happened. */
export async function listSaved(userId: string): Promise<ListingCard[]> {
  const rows = await db
    .select({ id: SavedListing.listingId })
    .from(SavedListing)
    .where(eq(SavedListing.userId, userId))
    .orderBy(desc(SavedListing.createdAt));
  return listingCardsByIds(rows.map((r) => r.id));
}
