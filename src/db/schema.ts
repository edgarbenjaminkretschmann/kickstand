// Kickstand schema for Drizzle. Kept portable to Postgres: text ids, integer (ms) timestamps,
// ISO date strings, booleans and JSON through Drizzle modes, no SQLite-only features.
// Old Astro DB tables keep their names and columns so existing logic still fits.
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Defaults are set in the app, not as SQL expressions, so they behave the same on Postgres.
const now = () => new Date();
const createdAt = () => integer("createdAt", { mode: "timestamp_ms" }).notNull().$defaultFn(now);
const updatedAt = () => integer("updatedAt", { mode: "timestamp_ms" }).notNull().$defaultFn(now);

// --- Better Auth core tables (field names follow Better Auth's default schema) ---

export const User = sqliteTable("User", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const Session = sqliteTable(
  "Session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
  },
  (t) => [index("Session_userId_idx").on(t.userId)],
);

export const Account = sqliteTable(
  "Account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Account_userId_idx").on(t.userId)],
);

export const Verification = sqliteTable("Verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Members and bikes ---

/** Private contract data. User.name is the public display name; Profile.name is the full name for contracts. */
export const Profile = sqliteTable("Profile", {
  userId: text("userId")
    .primaryKey()
    .references(() => User.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  street: text("street").notNull().default(""),
  zipCity: text("zipCity").notNull().default(""),
  phone: text("phone").notNull().default(""),
  birthdate: text("birthdate"), // ISO YYYY-MM-DD
  licenseNumber: text("licenseNumber").notNull().default(""),
  licenseClassASince: text("licenseClassASince").notNull().default(""),
  city: text("city").notNull().default(""),
});

export const Bike = sqliteTable(
  "Bike",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => User.id),
    make: text("make").notNull(),
    model: text("model").notNull(),
    typeCode: text("typeCode").notNull().default(""), // D.2
    plate: text("plate").notNull().default(""), // A
    vin: text("vin").notNull().default(""), // E
    firstRegistration: text("firstRegistration"), // B, ISO date
    powerKw: integer("powerKw"), // P.2
    displacementCcm: integer("displacementCcm"), // P.1
    fuel: text("fuel").notNull().default(""), // P.3
    conditions: text("conditions").notNull().default(""), // 22
    insurer: text("insurer").notNull().default(""),
    policyNumber: text("policyNumber").notNull().default(""),
    liabilityCapEur: integer("liabilityCapEur").notNull().default(1000),
    photoPath: text("photoPath"), // storage key
    lendable: integer("lendable", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("Bike_ownerId_idx").on(t.ownerId)],
);

// --- Marketplace ---

export const Category = sqliteTable("category", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const Listing = sqliteTable(
  "listing",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => User.id),
    type: text("type").notNull(), // biete | suche
    categorySlug: text("categorySlug")
      .notNull()
      .references(() => Category.slug),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priceKind: text("priceKind").notNull().default("kostenlos"), // kostenlos | tausch | preis | vb
    priceCents: integer("priceCents"),
    zip: text("zip").notNull().default(""),
    city: text("city").notNull().default(""),
    country: text("country").notNull().default("DE"),
    status: text("status").notNull().default("aktiv"), // aktiv | reserviert | erledigt
    bikeId: text("bikeId").references(() => Bike.id),
    // Lowercased in JS (full Unicode, unlike SQLite's lower()) so search works the same everywhere.
    searchText: text("searchText").notNull().default(""),
    cityKey: text("cityKey").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("listing_status_createdAt_idx").on(t.status, t.createdAt),
    index("listing_categorySlug_idx").on(t.categorySlug),
    index("listing_city_idx").on(t.city),
    index("listing_cityKey_idx").on(t.cityKey),
    index("listing_userId_idx").on(t.userId),
  ],
);

export const ListingPhoto = sqliteTable(
  "listing_photo",
  {
    id: text("id").primaryKey(),
    listingId: text("listingId")
      .notNull()
      .references(() => Listing.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // storage key
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("listing_photo_listingId_idx").on(t.listingId, t.sort)],
);

export const SavedListing = sqliteTable(
  "saved_listing",
  {
    userId: text("userId")
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    listingId: text("listingId")
      .notNull()
      .references(() => Listing.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const Conversation = sqliteTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    listingId: text("listingId")
      .notNull()
      .references(() => Listing.id, { onDelete: "cascade" }),
    buyerId: text("buyerId")
      .notNull()
      .references(() => User.id),
    sellerId: text("sellerId")
      .notNull()
      .references(() => User.id),
    createdAt: createdAt(),
    lastMessageAt: integer("lastMessageAt", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("conversation_listing_buyer_idx").on(t.listingId, t.buyerId),
    index("conversation_buyerId_idx").on(t.buyerId),
    index("conversation_sellerId_idx").on(t.sellerId),
  ],
);

export const Message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversationId")
      .notNull()
      .references(() => Conversation.id, { onDelete: "cascade" }),
    senderId: text("senderId")
      .notNull()
      .references(() => User.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    readAt: integer("readAt", { mode: "timestamp_ms" }),
  },
  (t) => [index("message_conversationId_createdAt_idx").on(t.conversationId, t.createdAt)],
);

// --- Loans ---

export const Loan = sqliteTable(
  "Loan",
  {
    id: text("id").primaryKey(),
    bikeId: text("bikeId")
      .notNull()
      .references(() => Bike.id),
    lenderId: text("lenderId")
      .notNull()
      .references(() => User.id),
    listingId: text("listingId").references(() => Listing.id, { onDelete: "set null" }),
    conversationId: text("conversationId").references(() => Conversation.id, { onDelete: "set null" }),
    status: text("status").notNull().default("draft"), // draft | active | returned
    borrowerName: text("borrowerName").notNull().default(""),
    borrowerStreet: text("borrowerStreet").notNull().default(""),
    borrowerZipCity: text("borrowerZipCity").notNull().default(""),
    borrowerBirthdate: text("borrowerBirthdate"),
    borrowerPhone: text("borrowerPhone").notNull().default(""),
    licenseNumber: text("licenseNumber").notNull().default(""),
    licenseClassASince: text("licenseClassASince").notNull().default(""),
    startDate: text("startDate"), // ISO date
    startTime: text("startTime"), // HH:MM
    endMode: text("endMode").notNull().default("open"), // open | fixed
    endDate: text("endDate"),
    endTime: text("endTime"),
    latestEndDate: text("latestEndDate"),
    returnPlace: text("returnPlace").notNull().default(""),
    liabilityCapEur: integer("liabilityCapEur").notNull().default(1000),
    handedOverItems: text("handedOverItems", { mode: "json" })
      .$type<{ keys: boolean; keyCount: number; registration: boolean; other: string }>()
      .notNull()
      .default({ keys: true, keyCount: 1, registration: true, other: "" }),
    placeDate: text("placeDate").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("Loan_bikeId_status_idx").on(t.bikeId, t.status), index("Loan_lenderId_idx").on(t.lenderId)],
);

export const Protocol = sqliteTable(
  "Protocol",
  {
    id: text("id").primaryKey(),
    loanId: text("loanId")
      .notNull()
      .references(() => Loan.id),
    kind: text("kind").notNull(), // handover | return
    datetime: text("datetime"), // ISO "YYYY-MM-DDTHH:MM"
    odometerKm: integer("odometerKm"),
    fuelLevel: text("fuelLevel").notNull().default(""),
    damages: text("damages").notNull().default(""),
  },
  (t) => [uniqueIndex("Protocol_loanId_kind_idx").on(t.loanId, t.kind)],
);

export const Photo = sqliteTable(
  "Photo",
  {
    id: text("id").primaryKey(),
    protocolId: text("protocolId")
      .notNull()
      .references(() => Protocol.id),
    path: text("path").notNull(), // storage key
    takenAt: integer("takenAt", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [index("Photo_protocolId_idx").on(t.protocolId)],
);

export const Signature = sqliteTable(
  "Signature",
  {
    id: text("id").primaryKey(),
    loanId: text("loanId")
      .notNull()
      .references(() => Loan.id),
    role: text("role").notNull(), // lender | borrower
    pngDataUrl: text("pngDataUrl").notNull(),
  },
  (t) => [uniqueIndex("Signature_loanId_role_idx").on(t.loanId, t.role)],
);

export type BikeRow = typeof Bike.$inferSelect;
export type LoanRow = typeof Loan.$inferSelect;
export type ProfileRow = typeof Profile.$inferSelect;
export type ListingRow = typeof Listing.$inferSelect;
