// File storage behind one small interface. The backend comes from the platform: local disk on Node
// (UPLOAD_DIR), R2 on Cloudflare Workers, later Google Cloud Storage. Access checks happen in the media endpoints.
import { createStorage, prepareImage } from "#platform";
import type { StorageAdapter } from "./types";

export type { SaveOptions, StorageAdapter } from "./types";

export const storage: StorageAdapter = createStorage();

export { isImageFile } from "../uploads";

/** Shrinks an uploaded photo (max 1600 px, EXIF rotation, no metadata) and stores it as JPEG. Returns the key. */
export async function saveImage(file: File, dir: string, name: string): Promise<string> {
  const buffer = await prepareImage(file);
  return storage.save(buffer, { dir, name, contentType: "image/jpeg" });
}

export function readFileByKey(key: string): Promise<Buffer | null> {
  return storage.read(key);
}

export async function deleteFile(key: string | null | undefined): Promise<void> {
  if (key) await storage.delete(key);
}
