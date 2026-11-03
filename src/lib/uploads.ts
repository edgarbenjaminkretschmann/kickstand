// Upload rules shared by every platform. The resizing itself lives in src/platform (sharp on Node,
// Cloudflare Images on Workers); where the bytes end up is decided by src/lib/storage.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 82;

/** A photo the form should reject with its German message (shown as a form error, not a 500). */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function isImageFile(f: unknown): f is File {
  return f instanceof File && f.size > 0 && f.type.startsWith("image/");
}

/** Throws the German message shown in the form when a file is over `maxBytes`. */
export function assertUploadSize(file: File, maxBytes: number): void {
  if (file.size > maxBytes) throw new UploadError(`Foto ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`);
}

/** "jpeg" | "png" | "webp" from the first bytes, or null. The browser's Content-Type is not trusted. */
export function sniffImage(head: Uint8Array): "jpeg" | "png" | "webp" | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, j) => head[i + j] === b);
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return null;
}

/** Throws the German form message unless the file really is a JPEG, PNG or WebP. */
export async function assertImageBytes(file: File): Promise<void> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!sniffImage(head)) throw new UploadError("Bitte ein Foto als JPEG, PNG oder WebP hochladen.");
}
