// Upload rules shared by every platform. The resizing itself lives in src/platform (sharp on Node,
// Cloudflare Images on Workers); where the bytes end up is decided by src/lib/storage.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 82;

export function isImageFile(f: unknown): f is File {
  return f instanceof File && f.size > 0 && f.type.startsWith("image/");
}

/** Throws the German message shown in the form when a file is over `maxBytes`. */
export function assertUploadSize(file: File, maxBytes: number): void {
  if (file.size > maxBytes) throw new Error(`Foto ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`);
}
