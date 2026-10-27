// @ts-check
// Build for Cloudflare Workers: `npm run build:cf`, then `wrangler dev` / `wrangler deploy` (see wrangler.jsonc).
// Same app as astro.config.mjs; only the adapter and the server bundling differ. "#platform" resolves to
// src/platform/cloudflare.ts here (R2 + Cloudflare Images) through the "workerd" import condition.
import cloudflare from "@astrojs/cloudflare";
import base from "./astro.config.mjs";

/** @type {import("astro").AstroUserConfig} */
const config = {
  ...base,
  adapter: cloudflare({ imageService: "passthrough", platformProxy: { enabled: false } }),
  // Kickstand keeps its sessions in the database (Better Auth); Astro's own session store is unused.
  session: { driver: "null" },
  vite: {
    ...base.vite,
    // Everything is bundled into the Worker; sharp is never imported on this platform.
    ssr: {},
  },
};

export default config;
