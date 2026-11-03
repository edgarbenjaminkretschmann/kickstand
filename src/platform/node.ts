// Node platform (npm run dev, Docker, tests, scripts): config from process.env, the full libSQL client
// (file: URLs), sharp for photos, files on local disk.
// The Workers build resolves "#platform" to ./cloudflare.ts instead (package.json "imports").
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import sharp from "sharp";
import { GoogleCloudStorage } from "../lib/storage/google";
import { LocalDiskStorage, uploadDir } from "../lib/storage/local";
import type { StorageAdapter } from "../lib/storage/types";
import { assertImageBytes, assertUploadSize, JPEG_QUALITY, MAX_SIDE } from "../lib/uploads";

export const platform = "node";

export function readVar(name: string): unknown {
  // process.env first, so a value present at build time is never inlined; Astro's .env loading second.
  return process.env[name] || (import.meta.env?.[name] as string | undefined);
}

/** Node has no bindings; callers fall back to disk, in-memory limits and so on. */
export function readBinding(_name: string): unknown {
  return undefined;
}

export function createDb(url: string, authToken?: string): LibSQLDatabase<typeof schema> {
  return drizzle(createClient({ url, authToken }), { schema });
}

export function createStorage(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "gcs") return new GoogleCloudStorage(process.env.GCS_BUCKET || "");
  return new LocalDiskStorage(uploadDir());
}

/** Max 1600 px on the long side, EXIF rotation applied, metadata stripped, JPEG. */
export async function prepareImage(file: File): Promise<Buffer> {
  assertUploadSize(file, 25 * 1024 * 1024);
  await assertImageBytes(file);
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
