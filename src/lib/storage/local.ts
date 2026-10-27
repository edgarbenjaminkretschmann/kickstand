// Files on disk under UPLOAD_DIR (default ./uploads). Used by `npm run dev`, Docker and the tests.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { keyFor, type SaveOptions, type StorageAdapter } from "./types";

export class LocalDiskStorage implements StorageAdapter {
  constructor(readonly root: string) {}

  /** Resolves a key and refuses anything that escapes the root. */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (full === this.root || !full.startsWith(this.root + path.sep)) throw new Error("invalid storage key");
    return full;
  }

  async save(buffer: Buffer, opts: SaveOptions): Promise<string> {
    const key = keyFor(opts);
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // already gone
    }
  }
}

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || (import.meta.env?.UPLOAD_DIR as string | undefined) || "./uploads");
}
