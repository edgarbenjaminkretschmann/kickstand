// Cloudflare Workers platform: photos in R2 (binding PHOTOS), resized by Cloudflare Images (binding IMAGES).
// Bindings are declared in wrangler.jsonc.
import { env } from "cloudflare:workers";
import { R2Storage } from "../lib/storage/r2";
import type { StorageAdapter } from "../lib/storage/types";
import { assertUploadSize, JPEG_QUALITY, MAX_SIDE } from "../lib/uploads";

interface Bindings {
  PHOTOS: R2Bucket;
  IMAGES: ImagesBinding;
}

const bindings = env as unknown as Bindings;

export const platform = "cloudflare";

export function createStorage(): StorageAdapter {
  return new R2Storage(bindings.PHOTOS);
}

/** Same result as the sharp version: max 1600 px, EXIF rotation applied, metadata stripped, JPEG. */
export async function prepareImage(file: File): Promise<Buffer> {
  // Cloudflare Images accepts at most 20 MB per input.
  assertUploadSize(file, 20 * 1024 * 1024);
  // "scale-down" never enlarges, so small photos (already shrunk in the browser) keep their size.
  const result = await bindings.IMAGES.input(file.stream())
    .transform({ width: MAX_SIDE, height: MAX_SIDE, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: JPEG_QUALITY });
  return Buffer.from(await result.response().arrayBuffer());
}
