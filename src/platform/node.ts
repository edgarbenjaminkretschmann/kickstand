// Node platform (npm run dev, Docker, tests, scripts): sharp for photos, files on local disk.
// The Workers build resolves "#platform" to ./cloudflare.ts instead (package.json "imports").
import sharp from "sharp";
import { GoogleCloudStorage } from "../lib/storage/google";
import { LocalDiskStorage, uploadDir } from "../lib/storage/local";
import type { StorageAdapter } from "../lib/storage/types";
import { assertUploadSize, JPEG_QUALITY, MAX_SIDE } from "../lib/uploads";

export const platform = "node";

export function createStorage(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "gcs") return new GoogleCloudStorage(process.env.GCS_BUCKET || "");
  return new LocalDiskStorage(uploadDir());
}

/** Max 1600 px on the long side, EXIF rotation applied, metadata stripped, JPEG. */
export async function prepareImage(file: File): Promise<Buffer> {
  assertUploadSize(file, 25 * 1024 * 1024);
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
