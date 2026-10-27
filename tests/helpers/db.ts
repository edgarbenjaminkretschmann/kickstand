// Test database: migrations from ./drizzle on the in-memory DB, plus two members and a bike.
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../../src/db/client";
import { Bike, User } from "../../src/db/schema";

export const ERIKA = "user_erika";
export const MAX = "user_max";
export const OTTO = "user_otto";
export const ERIKA_BIKE = "bike_erika";
export const MAX_BIKE = "bike_max";

export async function setupDb() {
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  for (const [id, name] of [
    [ERIKA, "Erika Mustermann"],
    [MAX, "Max Beispiel"],
    [OTTO, "Otto Normal"],
  ]) {
    await db.insert(User).values({ id, name, email: `${id}@kickstand.test` });
  }
  await db.insert(Bike).values([
    { id: ERIKA_BIKE, ownerId: ERIKA, make: "Honda", model: "VFR 750 F" },
    { id: MAX_BIKE, ownerId: MAX, make: "Yamaha", model: "XT 600" },
  ]);
}

export const listingInput = (over: Partial<import("../../src/lib/data/listings").ListingInput> = {}) => ({
  type: "biete",
  categorySlug: "werkzeug",
  title: "Montageständer zu verleihen",
  description: "",
  priceKind: "kostenlos",
  priceCents: null,
  zip: "12345",
  city: "Musterstadt",
  country: "DE",
  bikeId: null,
  ...over,
});
