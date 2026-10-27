// The few Cloudflare Workers types Kickstand uses. Declared here instead of pulling in
// @cloudflare/workers-types, whose globals clash with the DOM types Astro pages use.

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): {
    transform(t: { width?: number; height?: number; fit?: "scale-down" | "contain" | "cover" }): {
      output(o: { format: "image/jpeg" | "image/webp"; quality?: number }): Promise<{ response(): Response }>;
    };
  };
}
