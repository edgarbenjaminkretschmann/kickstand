// Nachrichten between a member and the owner of a listing. Only those two can read a conversation.
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "../../db/client";
import { Conversation, Listing, ListingPhoto, Message, User } from "../../db/schema";
import { getActiveLoan } from "./bikes";
import { tk } from "../../i18n";
import { badRequest, newId, notFound } from "./errors";

// The limit is also spelled out in the message "Höchstens 4000 Zeichen." (a translation key); change both together.
export const MAX_MESSAGE_LENGTH = 4000;

export interface ConversationListing {
  id: string;
  userId: string;
  title: string;
  type: string;
  categorySlug: string;
  status: string;
  bikeId: string | null;
  coverPhotoId: string | null;
}

export interface ConversationView {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: Date;
  lastMessageAt: Date;
  role: "buyer" | "seller";
  other: { id: string; name: string };
  listing: ConversationListing;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationListItem extends ConversationView {
  lastMessage: string;
  unread: number;
}

async function coverOf(listingIds: string[]): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map();
  const rows = await db
    .select({ id: ListingPhoto.id, listingId: ListingPhoto.listingId })
    .from(ListingPhoto)
    .where(inArray(ListingPhoto.listingId, listingIds))
    .orderBy(asc(ListingPhoto.sort), asc(ListingPhoto.id));
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.listingId)) m.set(r.listingId, r.id);
  return m;
}

const isMember = (userId: string) => or(eq(Conversation.buyerId, userId), eq(Conversation.sellerId, userId));

function toListing(l: typeof Listing.$inferSelect, covers: Map<string, string>): ConversationListing {
  return {
    id: l.id,
    userId: l.userId,
    title: l.title,
    type: l.type,
    categorySlug: l.categorySlug,
    status: l.status,
    bikeId: l.bikeId,
    coverPhotoId: covers.get(l.id) ?? null,
  };
}

/** The conversation as seen by `userId`, or null if they are neither buyer nor seller. */
export async function getConversationForUser(conversationId: string, userId: string): Promise<ConversationView | null> {
  const [row] = await db
    .select({ c: Conversation, l: Listing })
    .from(Conversation)
    .innerJoin(Listing, eq(Listing.id, Conversation.listingId))
    .where(and(eq(Conversation.id, conversationId), isMember(userId)));
  if (!row) return null;
  const role = row.c.buyerId === userId ? "buyer" : "seller";
  const otherId = role === "buyer" ? row.c.sellerId : row.c.buyerId;
  const [other] = await db.select({ id: User.id, name: User.name }).from(User).where(eq(User.id, otherId));
  return { ...row.c, role, other: other ?? { id: otherId, name: tk("Mitglied") }, listing: toListing(row.l, await coverOf([row.l.id])) };
}

export async function findConversation(listingId: string, buyerId: string): Promise<string | null> {
  const [c] = await db
    .select({ id: Conversation.id })
    .from(Conversation)
    .where(and(eq(Conversation.listingId, listingId), eq(Conversation.buyerId, buyerId)));
  return c?.id ?? null;
}

function checkBody(body: string): string {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) badRequest(tk("Bitte eine Nachricht schreiben."));
  if (text.length > MAX_MESSAGE_LENGTH) badRequest(tk("Höchstens 4000 Zeichen."));
  return text;
}

/**
 * Opens (or reuses) the conversation between a member and a listing's owner and posts the first message.
 * Not allowed for your own listing, for listings that are not active, or for a bike that is lent out right now.
 */
export async function startConversation(listingId: string, buyerId: string, body: string): Promise<string> {
  const [listing] = await db.select().from(Listing).where(eq(Listing.id, listingId));
  if (!listing) notFound(tk("Anzeige nicht gefunden."));
  if (listing.userId === buyerId) badRequest(tk("Das ist deine eigene Anzeige."));
  const existing = await findConversation(listingId, buyerId);
  if (existing) {
    await sendMessage(existing, buyerId, body);
    return existing;
  }
  if (listing.status !== "aktiv") badRequest(tk("Diese Anzeige ist nicht mehr aktiv."));
  if (listing.bikeId && (await getActiveLoan(listing.bikeId))) badRequest(tk("Das Motorrad ist gerade verliehen. Bitte später nochmal schauen."));
  const text = checkBody(body);
  const id = newId();
  const now = new Date();
  await db.insert(Conversation).values({ id, listingId, buyerId, sellerId: listing.userId, createdAt: now, lastMessageAt: now });
  await db.insert(Message).values({ id: newId(), conversationId: id, senderId: buyerId, body: text, createdAt: now });
  return id;
}

/** Posts a message. Only buyer and seller may write. */
export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<MessageRecord> {
  const [c] = await db
    .select()
    .from(Conversation)
    .where(and(eq(Conversation.id, conversationId), isMember(senderId)));
  if (!c) notFound(tk("Unterhaltung nicht gefunden."));
  const text = checkBody(body);
  const msg: MessageRecord = { id: newId(), conversationId: c.id, senderId, body: text, createdAt: new Date(), readAt: null };
  await db.insert(Message).values(msg);
  await db.update(Conversation).set({ lastMessageAt: msg.createdAt }).where(eq(Conversation.id, c.id));
  return msg;
}

/** Messages of a conversation, oldest first. `after` returns only newer ones (for the poll). Null without access. */
export async function listMessages(conversationId: string, userId: string, after?: Date): Promise<MessageRecord[] | null> {
  const c = await getConversationForUser(conversationId, userId);
  if (!c) return null;
  return db
    .select()
    .from(Message)
    .where(and(eq(Message.conversationId, c.id), after ? gt(Message.createdAt, after) : undefined))
    .orderBy(asc(Message.createdAt), asc(Message.id));
}

/**
 * The 15 s poll: access check and new messages in one indexed query (conversation by primary key,
 * messages by conversationId + createdAt). Null when the user is not a member of the conversation.
 */
export async function pollMessages(conversationId: string, userId: string, after?: Date): Promise<MessageRecord[] | null> {
  const rows = await db
    .select({ id: Conversation.id, m: Message })
    .from(Conversation)
    .leftJoin(Message, and(eq(Message.conversationId, Conversation.id), after ? gt(Message.createdAt, after) : undefined))
    .where(and(eq(Conversation.id, conversationId), isMember(userId)))
    .orderBy(asc(Message.createdAt), asc(Message.id));
  if (!rows.length) return null;
  return rows.flatMap((r) => (r.m ? [r.m] : []));
}

/** Marks the other person's messages as read once membership is known (the poll checked it). */
export async function markReadChecked(conversationId: string, userId: string): Promise<void> {
  await db
    .update(Message)
    .set({ readAt: new Date() })
    .where(and(eq(Message.conversationId, conversationId), ne(Message.senderId, userId), isNull(Message.readAt)));
}

/** Marks the other person's messages as read. */
export async function markRead(conversationId: string, userId: string): Promise<void> {
  const c = await getConversationForUser(conversationId, userId);
  if (!c) return;
  await db
    .update(Message)
    .set({ readAt: new Date() })
    .where(and(eq(Message.conversationId, c.id), ne(Message.senderId, userId), isNull(Message.readAt)));
}

/** Number of unread messages addressed to the user, over all conversations. */
export async function unreadTotal(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(Message)
    .innerJoin(Conversation, eq(Conversation.id, Message.conversationId))
    .where(and(isMember(userId), ne(Message.senderId, userId), isNull(Message.readAt)));
  return r?.n ?? 0;
}

/** The user's conversations, most recent first, with unread counts and the last message. */
export async function listConversations(userId: string, opts: { listingId?: string } = {}): Promise<ConversationListItem[]> {
  const rows = await db
    .select({ c: Conversation, l: Listing })
    .from(Conversation)
    .innerJoin(Listing, eq(Listing.id, Conversation.listingId))
    .where(and(isMember(userId), opts.listingId ? eq(Conversation.listingId, opts.listingId) : undefined))
    .orderBy(desc(Conversation.lastMessageAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.c.id);
  const otherIds = [...new Set(rows.map((r) => (r.c.buyerId === userId ? r.c.sellerId : r.c.buyerId)))];
  const users = await db.select({ id: User.id, name: User.name }).from(User).where(inArray(User.id, otherIds));
  const names = new Map(users.map((u) => [u.id, u.name]));
  const unreadRows = await db
    .select({ conversationId: Message.conversationId, n: count() })
    .from(Message)
    .where(and(inArray(Message.conversationId, ids), ne(Message.senderId, userId), isNull(Message.readAt)))
    .groupBy(Message.conversationId);
  const unread = new Map(unreadRows.map((r) => [r.conversationId, r.n]));
  const last = new Map<string, string>();
  const recent = await db
    .select({ conversationId: Message.conversationId, body: Message.body })
    .from(Message)
    .where(inArray(Message.conversationId, ids))
    .orderBy(desc(Message.createdAt), desc(Message.id));
  for (const m of recent) if (!last.has(m.conversationId)) last.set(m.conversationId, m.body);
  const covers = await coverOf([...new Set(rows.map((r) => r.l.id))]);
  return rows.map(({ c, l }) => {
    const role = c.buyerId === userId ? "buyer" : "seller";
    const otherId = role === "buyer" ? c.sellerId : c.buyerId;
    return {
      ...c,
      role,
      other: { id: otherId, name: names.get(otherId) ?? tk("Mitglied") },
      listing: toListing(l, covers),
      lastMessage: last.get(c.id) ?? "",
      unread: unread.get(c.id) ?? 0,
    };
  });
}
