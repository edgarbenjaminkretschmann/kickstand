// Loans, protocols, photos and signatures. Also decides who may see a loan.
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/client";
import { Bike, Conversation, Listing, Loan, Photo, Profile, Protocol, Signature, User } from "../../db/schema";
import { newId } from "./errors";
import type { HandedOverItems, Loan as LoanRecord } from "./types";

export type LoanRole = "lender" | "borrower";
export type ProtocolKind = "handover" | "return";
export type LoanValues = Partial<Omit<LoanRecord, "id" | "bikeId" | "lenderId" | "createdAt">>;

export async function getLoan(loanId: string): Promise<LoanRecord | null> {
  const [loan] = await db.select().from(Loan).where(eq(Loan.id, loanId));
  return loan ?? null;
}

export async function getOwnLoan(loanId: string, userId: string): Promise<LoanRecord | null> {
  const [loan] = await db.select().from(Loan).where(and(eq(Loan.id, loanId), eq(Loan.lenderId, userId)));
  return loan ?? null;
}

/**
 * The loan plus the viewer's role, or null if the viewer is neither the lender nor the member
 * the lender talked to in the linked conversation.
 */
export async function getLoanForUser(loanId: string, userId: string): Promise<{ loan: LoanRecord; role: LoanRole } | null> {
  const loan = await getLoan(loanId);
  if (!loan) return null;
  if (loan.lenderId === userId) return { loan, role: "lender" };
  if (loan.conversationId) {
    const [c] = await db.select().from(Conversation).where(eq(Conversation.id, loan.conversationId));
    if (c && c.sellerId === loan.lenderId && c.buyerId === userId) return { loan, role: "borrower" };
  }
  return null;
}

export async function createLoan(id: string, bikeId: string, lenderId: string, values: LoanValues): Promise<void> {
  await db.insert(Loan).values({ id, bikeId, lenderId, status: "draft", ...values });
}

export async function updateLoan(id: string, values: LoanValues): Promise<void> {
  await db.update(Loan).set(values).where(eq(Loan.id, id));
}

export async function listDrafts(bikeId: string, lenderId: string): Promise<LoanRecord[]> {
  return db
    .select()
    .from(Loan)
    .where(and(eq(Loan.bikeId, bikeId), eq(Loan.lenderId, lenderId), eq(Loan.status, "draft")))
    .orderBy(desc(Loan.createdAt));
}

/**
 * Links a loan to a listing and conversation only when they fit: the listing belongs to the lender
 * and offers this bike, and the conversation is the lender's, about that listing.
 */
export async function resolveLoanLinks(
  lenderId: string,
  bikeId: string,
  listingId: string | null | undefined,
  conversationId: string | null | undefined,
): Promise<{ listingId: string | null; conversationId: string | null }> {
  let conv: typeof Conversation.$inferSelect | undefined;
  if (conversationId) {
    [conv] = await db.select().from(Conversation).where(and(eq(Conversation.id, conversationId), eq(Conversation.sellerId, lenderId)));
  }
  const wantedListing = listingId || conv?.listingId || null;
  let listing: typeof Listing.$inferSelect | undefined;
  if (wantedListing) {
    [listing] = await db
      .select()
      .from(Listing)
      .where(and(eq(Listing.id, wantedListing), eq(Listing.userId, lenderId), eq(Listing.bikeId, bikeId)));
  }
  if (!listing) return { listingId: null, conversationId: null };
  return { listingId: listing.id, conversationId: conv && conv.listingId === listing.id ? conv.id : null };
}

// --- Protocols, photos, signatures ---

export async function getProtocol(loanId: string, kind: ProtocolKind) {
  const [p] = await db.select().from(Protocol).where(and(eq(Protocol.loanId, loanId), eq(Protocol.kind, kind)));
  return p ?? null;
}

export async function upsertProtocol(
  loanId: string,
  kind: ProtocolKind,
  values: { datetime: string | null; odometerKm: number | null; fuelLevel: string; damages: string },
): Promise<string> {
  const existing = await getProtocol(loanId, kind);
  if (existing) {
    await db.update(Protocol).set(values).where(eq(Protocol.id, existing.id));
    return existing.id;
  }
  const id = newId();
  await db.insert(Protocol).values({ id, loanId, kind, ...values });
  return id;
}

export async function ensureProtocol(loanId: string, kind: ProtocolKind): Promise<string> {
  const existing = await getProtocol(loanId, kind);
  if (existing) return existing.id;
  return upsertProtocol(loanId, kind, { datetime: null, odometerKm: null, fuelLevel: "", damages: "" });
}

export async function addPhoto(id: string, protocolId: string, key: string, takenAt: Date): Promise<void> {
  await db.insert(Photo).values({ id, protocolId, path: key, takenAt });
}

/** A protocol photo with its protocol and loan, for access checks. */
export async function getPhotoWithLoan(photoId: string) {
  const [row] = await db
    .select({ photo: Photo, protocol: Protocol, loan: Loan })
    .from(Photo)
    .innerJoin(Protocol, eq(Protocol.id, Photo.protocolId))
    .innerJoin(Loan, eq(Loan.id, Protocol.loanId))
    .where(eq(Photo.id, photoId));
  return row ?? null;
}

export async function deletePhotoRow(photoId: string): Promise<void> {
  await db.delete(Photo).where(eq(Photo.id, photoId));
}

export async function getSignature(signatureId: string) {
  const [sig] = await db.select().from(Signature).where(eq(Signature.id, signatureId));
  return sig ?? null;
}

/** Stores, replaces or (with an empty value) removes a signature. Validation happens in the caller. */
export async function setSignature(loanId: string, role: "lender" | "borrower", dataUrl: string): Promise<void> {
  if (!dataUrl) {
    await db.delete(Signature).where(and(eq(Signature.loanId, loanId), eq(Signature.role, role)));
    return;
  }
  const [existing] = await db.select().from(Signature).where(and(eq(Signature.loanId, loanId), eq(Signature.role, role)));
  if (existing) {
    if (existing.pngDataUrl !== dataUrl) await db.update(Signature).set({ pngDataUrl: dataUrl }).where(eq(Signature.id, existing.id));
  } else {
    await db.insert(Signature).values({ id: newId(), loanId, role, pngDataUrl: dataUrl });
  }
}

/** Deletes a draft with everything attached. Returns the storage keys of its photos so the caller can remove the files. */
export async function deleteLoanCascade(loanId: string): Promise<string[]> {
  const protocols = await db.select().from(Protocol).where(eq(Protocol.loanId, loanId));
  const ids = protocols.map((p) => p.id);
  const photos = ids.length ? await db.select().from(Photo).where(inArray(Photo.protocolId, ids)) : [];
  if (ids.length) await db.delete(Photo).where(inArray(Photo.protocolId, ids));
  await db.delete(Protocol).where(eq(Protocol.loanId, loanId));
  await db.delete(Signature).where(eq(Signature.loanId, loanId));
  await db.delete(Loan).where(eq(Loan.id, loanId));
  return photos.map((p) => p.path);
}

// --- Contract and dashboard reads ---

export const DEFAULT_ITEMS: HandedOverItems = { keys: true, keyCount: 1, registration: true, other: "" };

export function toItems(value: unknown): HandedOverItems {
  const v = (value ?? {}) as Partial<HandedOverItems>;
  return {
    keys: v.keys ?? DEFAULT_ITEMS.keys,
    keyCount: Number(v.keyCount) || 1,
    registration: v.registration ?? DEFAULT_ITEMS.registration,
    other: v.other ?? "",
  };
}

/** Everything about one loan: bike, lender, protocols, photos, signatures. */
export async function loadLoanParts(loanId: string) {
  const loan = await getLoan(loanId);
  if (!loan) return null;
  const [bike] = await db.select().from(Bike).where(eq(Bike.id, loan.bikeId));
  const [lenderUser] = await db.select().from(User).where(eq(User.id, loan.lenderId));
  const [lenderProfile] = await db.select().from(Profile).where(eq(Profile.userId, loan.lenderId));
  const protocols = await db.select().from(Protocol).where(eq(Protocol.loanId, loan.id));
  const protocolIds = protocols.map((p) => p.id);
  const photos = protocolIds.length
    ? await db.select().from(Photo).where(inArray(Photo.protocolId, protocolIds)).orderBy(asc(Photo.takenAt))
    : [];
  const signatures = await db.select().from(Signature).where(eq(Signature.loanId, loan.id));
  const handover = protocols.find((p) => p.kind === "handover") ?? null;
  const ret = protocols.find((p) => p.kind === "return") ?? null;
  const photosOf = (protocolId: string | undefined) => photos.filter((p) => p.protocolId === protocolId);
  return {
    loan,
    bike,
    lender: {
      name: loan.lenderName || lenderProfile?.name || lenderUser?.name || "",
      street: loan.lenderName ? (loan.lenderStreet ?? "") : (lenderProfile?.street ?? ""),
      zipCity: loan.lenderName ? (loan.lenderZipCity ?? "") : (lenderProfile?.zipCity ?? ""),
      city: lenderProfile?.city ?? "",
    },
    handover,
    ret,
    handoverPhotos: photosOf(handover?.id),
    returnPhotos: photosOf(ret?.id),
    signatures: {
      lender: signatures.find((s) => s.role === "lender") ?? null,
      borrower: signatures.find((s) => s.role === "borrower") ?? null,
    },
  };
}

export type LoanParts = NonNullable<Awaited<ReturnType<typeof loadLoanParts>>>;

/** Loans for "Mein Bereich": what I lend out, what I borrow, and recently returned ones. */
export async function loansForDashboard(userId: string) {
  const lending = await db
    .select({ loan: Loan, bike: Bike })
    .from(Loan)
    .innerJoin(Bike, eq(Bike.id, Loan.bikeId))
    .where(and(eq(Loan.lenderId, userId), ne(Loan.status, "returned")))
    .orderBy(desc(Loan.createdAt));
  const borrowing = await db
    .select({ loan: Loan, bike: Bike })
    .from(Loan)
    .innerJoin(Bike, eq(Bike.id, Loan.bikeId))
    .innerJoin(Conversation, eq(Conversation.id, Loan.conversationId))
    .where(and(eq(Conversation.buyerId, userId), eq(Loan.status, "active")))
    .orderBy(desc(Loan.createdAt));
  const past = await db
    .select({ loan: Loan, bike: Bike })
    .from(Loan)
    .innerJoin(Bike, eq(Bike.id, Loan.bikeId))
    .where(and(eq(Loan.lenderId, userId), eq(Loan.status, "returned")))
    .orderBy(desc(Loan.createdAt))
    .limit(5);
  return { lending, borrowing, past };
}
