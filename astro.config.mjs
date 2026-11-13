// @ts-check
// One config for both targets. Default: Cloudflare Workers (npm run build / preview / deploy).
// KICKSTAND_TARGET=node builds the standalone Node server instead (Docker, a plain VPS).
// `npm run dev` runs in Node either way and needs no accounts: local SQLite file, photos on disk.
// "#platform" (package.json "imports") picks src/platform/cloudflare.ts in the Worker bundle through the
// "workerd" condition and src/platform/node.ts everywhere else.
import { readFileSync } from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

const target = process.env.KICKSTAND_TARGET === "node" ? "node" : "cloudflare";
const isDev = process.argv.includes("dev");

/** SITE_URL from wrangler.jsonc → vars, so `npm run deploy` cannot be built with the wrong origin. */
function wranglerSiteUrl() {
  try {
    const text = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
    const json = text
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
      .replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(json).vars?.SITE_URL;
  } catch {
    return undefined;
  }
}

// Public URL of the deployment: `site`, the trusted host for the origin check, Better Auth's fallback base URL.
const siteUrl = new URL(
  process.env.SITE_URL || (!isDev && target === "cloudflare" ? wranglerSiteUrl() : undefined) || "http://localhost:4321",
);

export default defineConfig({
  site: siteUrl.origin,
  output: "server",
  adapter:
    target === "node"
      ? node({ mode: "standalone" })
      : // "passthrough", not "compile": Kickstand does not use astro:assets (photos in public/images are already
        // optimised webp), and "compile" would bundle sharp and the /_image endpoint into the Worker.
        cloudflare({
          imageService: "passthrough",
          platformProxy: { enabled: false },
          // Adds the weekly cron handler (Brevo key keep-alive) next to the fetch handler.
          workerEntryPoint: { path: "src/worker.ts" },
        }),
  // Sessions live in the database (Better Auth). Astro's own session store is unused, so no KV namespace.
  session: target === "cloudflare" ? { driver: "null" } : undefined,
  security: {
    checkOrigin: true,
    // The Node adapter only trusts Host / X-Forwarded-* headers for these; otherwise every form POST fails.
    allowedDomains: [{ hostname: siteUrl.hostname }, { hostname: "localhost" }, { hostname: "127.0.0.1" }],
    // Without JS, phone photos are posted at full size (several MB each) before they are shrunk.
    actionBodySizeLimit: 80 * 1024 * 1024,
  },
  server: { host: true },
  vite: {
    // On Node, sharp and the native libSQL client stay outside the bundle. In the Worker everything is bundled
    // and neither is ever imported (see src/platform/cloudflare.ts).
    ssr: target === "node" ? { external: ["sharp", "@libsql/client"] } : {},
    // jsPDF is lazy-loaded; pre-bundle it so the first "PDF erstellen" in dev does not hit a stale dep (504).
    optimizeDeps: { include: ["jspdf"] },
  },
});
