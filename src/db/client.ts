// The one database connection. Only src/lib/data/* and src/lib/auth import this.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Read at runtime so the URL is never compiled into the build. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || "file:./data/kickstand.db";
}

const client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN || undefined });

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
