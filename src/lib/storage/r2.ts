// Cloudflare R2 through a Worker binding. The bucket stays private; files leave only through the media endpoints.
import { assertKey, keyFor, type SaveOptions, type StorageAdapter } from "./types";

export class R2Storage implements StorageAdapter {
  constructor(readonly bucket: R2Bucket) {}

  async save(buffer: Buffer, opts: SaveOptions): Promise<string> {
    const key = keyFor(opts);
    assertKey(key);
    await this.bucket.put(key, buffer, { httpMetadata: { contentType: opts.contentType } });
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    assertKey(key);
    const obj = await this.bucket.get(key);
    return obj ? Buffer.from(await obj.arrayBuffer()) : null;
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.bucket.delete(key);
  }
}
