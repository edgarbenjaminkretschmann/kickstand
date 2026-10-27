// Demo data: `npm run db:seed`. Wipes all rows first, so only use it on a dev or demo database.
// Refuses to run with NODE_ENV=production unless called with --force.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/db/client";
import { CATEGORIES } from "../src/db/categories";
import {
  Account,
  Bike,
  Category,
  Conversation,
  Listing,
  ListingPhoto,
  Loan,
  Message,
  Photo,
  Profile,
  Protocol,
  SavedListing,
  Session,
  Signature,
  User,
  Verification,
} from "../src/db/schema";
import { DEMO_PASSWORD, demoBike, demoConversation, demoListings, demoLoan, demoProtocols, demoSaved, demoUsers } from "../src/db/seed-data";
import { searchKey } from "../src/lib/data/listings";
import { storage } from "../src/lib/storage";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed with NODE_ENV=production. Pass --force if you really want demo data there.");
  process.exit(1);
}

// Children first, so foreign keys never block the wipe.
for (const table of [Message, Conversation, SavedListing, Signature, Photo, Protocol, Loan, ListingPhoto, Listing, Bike, Profile, Session, Account, Verification, User]) {
  await db.delete(table);
}

for (const c of CATEGORIES) {
  await db.insert(Category).values(c).onConflictDoUpdate({ target: Category.slug, set: { label: c.label, sort: c.sort } });
}

const hash = await hashPassword(DEMO_PASSWORD);
const joined = [new Date("2025-03-12T10:00:00Z"), new Date("2025-08-02T10:00:00Z")];
for (const [i, u] of demoUsers.entries()) {
  await db.insert(User).values({ id: u.id, name: u.name, email: u.email, emailVerified: true, createdAt: joined[i], updatedAt: joined[i] });
  await db.insert(Account).values({ id: `acc_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash });
  await db.insert(Profile).values({ userId: u.id, ...u.profile });
}

await db.insert(Bike).values(demoBike);

for (const { photo, ...l } of demoListings) {
  await db.insert(Listing).values({
    status: "aktiv",
    country: "DE",
    ...l,
    searchText: searchKey(`${l.title} ${l.description}`),
    cityKey: searchKey(l.city),
    updatedAt: l.createdAt,
  });
  if (photo) {
    const source = await readFile(path.resolve("public/images", photo));
    const jpeg = await sharp(source).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const key = await storage.save(jpeg, { dir: `listings/${l.id}`, name: `seed-${path.parse(photo).name}`, contentType: "image/jpeg" });
    await db.insert(ListingPhoto).values({ id: `photo_${l.id}`, listingId: l.id, key, sort: 0 });
  }
}

const now = Date.now();
const { messages, ...conv } = demoConversation;
const at = (h: number) => new Date(now - h * 3_600_000);
await db.insert(Conversation).values({ ...conv, createdAt: at(messages[0].hoursAgo), lastMessageAt: at(messages.at(-1)!.hoursAgo) });
for (const m of messages) {
  await db.insert(Message).values({
    id: m.id,
    conversationId: conv.id,
    senderId: m.senderId,
    body: m.body,
    createdAt: at(m.hoursAgo),
    readAt: "read" in m && m.read ? at(m.hoursAgo - 1) : null,
  });
}

await db.insert(Loan).values(demoLoan);
await db.insert(Protocol).values(demoProtocols);
for (const s of demoSaved) await db.insert(SavedListing).values(s);

console.log(`Seeded ${demoUsers.length} users, ${demoListings.length} listings, 1 conversation, 1 loan.`);
