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

// JPEG segments that carry metadata: APP1 (EXIF incl. GPS, XMP), APP3–APP13 (IPTC and vendor data),
// APP15, comments. Kept: APP0 (JFIF), APP2 (ICC colour profile), APP14 (Adobe colour transform).
const DROP_MARKERS = new Set([0xe1, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xef, 0xfe]);

/**
 * Removes EXIF/GPS, XMP, IPTC and comments from a JPEG without re-encoding it. Pure JS, so it runs in
 * Workers. Call it on images that are already rotated upright (the orientation tag goes too).
 * Returns the input unchanged if it is not a JPEG or the structure is unexpected.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input[0] !== 0xff || input[1] !== 0xd8) return input;
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) return input;
    const marker = input[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xda) {
      out.push(input.subarray(i)); // start of scan: image data until the end, copied as is
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (input[i + 2] << 8) | input[i + 3];
    if (len < 2 || i + 2 + len > input.length) return input;
    if (!DROP_MARKERS.has(marker)) out.push(input.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  const total = out.reduce((n, part) => n + part.length, 0);
  const result = new Uint8Array(total);
  let at = 0;
  for (const part of out) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
