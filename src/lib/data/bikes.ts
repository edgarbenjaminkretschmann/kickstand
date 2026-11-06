import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { Bike, Loan } from "../../db/schema";
import type { Bike as BikeRecord } from "./types";

export type BikeValues = Omit<BikeRecord, "id" | "ownerId" | "createdAt">;

export async function getBike(bikeId: string): Promise<BikeRecord | null> {
  const [bike] = await db.select().from(Bike).where(eq(Bike.id, bikeId));
  return bike ?? null;
}

/** The bike, only if it belongs to the user. */
export async function getOwnBike(bikeId: string, userId: string): Promise<BikeRecord | null> {
  const [bike] = await db.select().from(Bike).where(and(eq(Bike.id, bikeId), eq(Bike.ownerId, userId)));
  return bike ?? null;
}

export async function listOwnBikes(userId: string): Promise<BikeRecord[]> {
  return db.select().from(Bike).where(eq(Bike.ownerId, userId)).orderBy(desc(Bike.createdAt));
}

export async function createBike(ownerId: string, id: string, values: BikeValues): Promise<void> {
  await db.insert(Bike).values({ id, ownerId, ...values });
}

export async function updateBike(id: string, values: BikeValues): Promise<void> {
  await db.update(Bike).set(values).where(eq(Bike.id, id));
}

/**
 * Picks the member's bike a contract is about: same FIN, or same plate when one of the two has no FIN.
 * A plate alone never joins two different FINs, since plates move on when a bike is sold.
 */
export function matchBike<T extends { vin: string; plate: string }>(bikes: T[], vin: string, plate: string): T | null {
  const same = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
  return (
    (vin && bikes.find((b) => b.vin && same(b.vin, vin))) ||
    (plate && bikes.find((b) => b.plate && same(b.plate, plate) && (!vin || !b.vin))) ||
    null
  );
}

/** The active loan of a bike, if any. */
export async function getActiveLoan(bikeId: string) {
  const [loan] = await db.select().from(Loan).where(and(eq(Loan.bikeId, bikeId), eq(Loan.status, "active")));
  return loan ?? null;
}

/** Which of these bikes are lent out right now. */
export async function lentBikeIds(bikeIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(bikeIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await db
    .select({ bikeId: Loan.bikeId })
    .from(Loan)
    .where(and(inArray(Loan.bikeId, ids), eq(Loan.status, "active")));
  return new Set(rows.map((r) => r.bikeId));
}
