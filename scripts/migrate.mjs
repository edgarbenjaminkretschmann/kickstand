// Applies pending migrations from ./drizzle. Plain JS so it also runs in the production image
// (no tsx, no drizzle-kit there). Usage: node scripts/migrate.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL || "file:./data/kickstand.db";
if (url.startsWith("file:")) mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
await migrate(drizzle(client), { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
client.close();
console.log(`Migrations applied (${url.replace(/\?.*$/, "")}).`);
