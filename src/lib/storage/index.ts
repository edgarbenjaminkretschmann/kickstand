// File storage behind one small interface. The backend comes from the platform: local disk on Node
// (UPLOAD_DIR), R2 on Cloudflare Workers, later Google Cloud Storage. Access checks happen in the media endpoints.
// The adapter is created on first use: on Workers the R2 binding only exists while a request runs.
import { createStorage, prepareImage } from "#platform";
import type { StorageAdapter } from "./types";

export type { SaveOptions, StorageAdapter } from "./types";

let instance: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (!instance) instance = createStorage();
  return instance;
}

export { isImageFile } from "../uploads";

/** Shrinks an uploaded photo (max 1600 px, EXIF rotation, no metadata) and stores it as JPEG. Returns the key. */
export async function saveImage(file: File, dir: string, name: string): Promise<string> {
  const buffer = await prepareImage(file);
  return getStorage().save(buffer, { dir, name, contentType: "image/jpeg" });
}

export function readFileByKey(key: string): Promise<Buffer | null> {
  return getStorage().read(key);
}

export async function deleteFile(key: string | null | undefined): Promise<void> {
  if (key) await getStorage().delete(key);
}
