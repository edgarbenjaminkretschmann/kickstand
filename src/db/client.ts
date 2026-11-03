// The one database connection. Only src/lib/data/* and src/lib/auth import this.
// Created on first use, not at import: on Workers the URL and token only exist while a request runs.
// The libSQL client and drizzle driver come from "#platform": the full client on Node (file: URLs), the
// HTTP-only client on Workers, so the native SQLite binary never ends up in the Worker bundle.
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { createDb } from "#platform";
import { env } from "../lib/env";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

export function databaseUrl(): string {
  return env("DATABASE_URL") ?? "file:./data/kickstand.db";
}

let instance: Db | undefined;

export function getDb(): Db {
  if (!instance) instance = createDb(databaseUrl(), env("DATABASE_AUTH_TOKEN"));
  return instance;
}

/** Stands in for the drizzle instance and creates it on first property access. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    // Bind methods so `this` is the real instance; leave the constructor alone (drizzle's is() reads it).
    return typeof value === "function" && prop !== "constructor" ? value.bind(real) : value;
  },
});

export { schema };
