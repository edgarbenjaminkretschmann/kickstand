// The storage contract shared by every backend. Keys are relative POSIX paths ("listings/<id>/<photo>.jpg").

export interface SaveOptions {
  /** Folder inside the store, e.g. "listings/<listingId>". */
  dir: string;
  /** File name without extension. */
  name: string;
  contentType: string;
}

export interface StorageAdapter {
  /** Stores the bytes and returns the key to keep in the database. */
  save(buffer: Buffer, opts: SaveOptions): Promise<string>;
  /** The bytes for a key, or null if it does not exist. */
  read(key: string): Promise<Buffer | null>;
  /** Removes a key. Missing keys are fine. */
  delete(key: string): Promise<void>;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The key a backend stores a file under. */
export function keyFor(opts: SaveOptions): string {
  return `${opts.dir.replace(/\/+$/, "")}/${opts.name}.${EXT[opts.contentType] ?? "bin"}`;
}

/** Refuses keys that are absolute or climb out of the store. */
export function assertKey(key: string): void {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((p) => p === ".." || p === "")) {
    throw new Error("invalid storage key");
  }
}
