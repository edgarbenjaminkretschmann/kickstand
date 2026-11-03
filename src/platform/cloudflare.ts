// Cloudflare Workers platform: config from the Worker env, the HTTP-only libSQL client, photos in R2
// (binding PHOTOS), resized by Cloudflare Images (binding IMAGES). Bindings are declared in wrangler.jsonc.
// `env` from "cloudflare:workers" is only read inside functions, i.e. while a request runs.
import { env } from "cloudflare:workers";
import { createClient } from "@libsql/client/web";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "../db/schema";
import { R2Storage } from "../lib/storage/r2";
import type { StorageAdapter } from "../lib/storage/types";
import { assertImageBytes, assertUploadSize, JPEG_QUALITY, MAX_SIDE, stripJpegMetadata } from "../lib/uploads";

export const platform = "cloudflare";

export function readVar(name: string): unknown {
  return env[name];
}

export function readBinding(name: string): unknown {
  return env[name];
}

/** Workers can only talk to libSQL over HTTP; a file: URL here is a configuration mistake. */
export function createDb(url: string, authToken?: string): LibSQLDatabase<typeof schema> {
  if (url.startsWith("file:") || url === ":memory:") {
    throw new Error("DATABASE_URL must be a libsql:// or https:// URL on Cloudflare Workers");
  }
  return drizzle(createClient({ url, authToken }), { schema });
}

export function createStorage(): StorageAdapter {
  const bucket = env.PHOTOS as R2Bucket | undefined;
  if (!bucket) throw new Error("R2 binding PHOTOS is missing (wrangler.jsonc)");
  return new R2Storage(bucket);
}

/**
 * Same result as the sharp version: max 1600 px, EXIF rotation applied, metadata stripped, JPEG.
 * The Images binding rotates upright but copies EXIF (GPS included) into its output, so the metadata
 * segments are removed afterwards in plain JS. Listing photos are public.
 */
export async function prepareImage(file: File): Promise<Buffer> {
  // Cloudflare Images accepts at most 20 MB per input.
  assertUploadSize(file, 20 * 1024 * 1024);
  await assertImageBytes(file);
  // "scale-down" never enlarges, so small photos (already shrunk in the browser) keep their size.
  const result = await (env.IMAGES as ImagesBinding).input(file.stream())
    .transform({ width: MAX_SIDE, height: MAX_SIDE, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: JPEG_QUALITY });
  return Buffer.from(stripJpegMetadata(new Uint8Array(await result.response().arrayBuffer())));
}
