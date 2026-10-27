// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Public URL of the deployment. The Node adapter only trusts Host / X-Forwarded-* headers for
// domains listed in `allowedDomains`; otherwise every form POST fails Astro's origin check.
const siteUrl = new URL(process.env.SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:4321");

export default defineConfig({
  site: siteUrl.origin,
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    checkOrigin: true,
    allowedDomains: [{ hostname: siteUrl.hostname }, { hostname: "localhost" }, { hostname: "127.0.0.1" }],
    // Without JS, phone photos are posted at full size (several MB each) before sharp shrinks them.
    actionBodySizeLimit: 80 * 1024 * 1024,
  },
  server: { host: true },
  vite: {
    ssr: { external: ["sharp", "@libsql/client"] },
    // jsPDF is lazy-loaded; pre-bundle it so the first "PDF erstellen" in dev does not hit a stale dep (504).
    optimizeDeps: { include: ["jspdf"] },
  },
});
