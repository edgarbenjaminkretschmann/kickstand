import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { Profile, User } from "../../db/schema";
import type { Profile as ProfileRecord } from "./types";

export type ProfileValues = Omit<ProfileRecord, "userId">;

export interface Member {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const [profile] = await db.select().from(Profile).where(eq(Profile.userId, userId));
  return profile ?? null;
}

export async function getMember(userId: string): Promise<Member | null> {
  const [u] = await db
    .select({ id: User.id, name: User.name, email: User.email, image: User.image, createdAt: User.createdAt })
    .from(User)
    .where(eq(User.id, userId));
  return u ?? null;
}

export async function saveProfile(userId: string, values: ProfileValues): Promise<void> {
  await db
    .insert(Profile)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: Profile.userId, set: values });
}

/** Creates an empty profile on first sign-in (email or Google), prefilled with the display name. */
export async function ensureProfile(userId: string, displayName: string): Promise<void> {
  await db.insert(Profile).values({ userId, name: displayName }).onConflictDoNothing();
}

export async function setDisplayName(userId: string, name: string): Promise<void> {
  await db.update(User).set({ name, updatedAt: new Date() }).where(eq(User.id, userId));
}

/** "Beispiel, Max" or "Max Beispiel" -> "Max". */
export function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  if (n.includes(",")) return n.split(",")[1].trim().split(/\s+/)[0] || n.split(",")[0].trim();
  return n.split(/\s+/)[0];
}
