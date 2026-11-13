// Worker entry (astro.config.mjs → workerEntryPoint): Astro's own fetch handler plus a weekly cron.
// Brevo deletes an API key after 90 days without use, which would silently stop password-reset mails
// on a quiet site. The cron (wrangler.jsonc → triggers.crons) makes one cheap read call with the key so
// it never counts as unused. The key is restricted to transactional mail, so it reads the transactional
// stats endpoint (/account and /senders answer 403 for it).
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";

interface Env {
  BREVO_API_KEY?: string;
  [key: string]: unknown;
}
/** The bits of the Workers context used here (the full @cloudflare/workers-types clash with the DOM types). */
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export async function brevoKeepAlive(apiKey: string | undefined): Promise<void> {
  if (!apiKey) {
    console.warn("[cron] BREVO_API_KEY is not set, nothing to keep alive");
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1", {
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  // A failure here is the early warning that reset mails will fail too; it shows up in the Worker logs.
  if (!res.ok) throw new Error(`Brevo keep-alive answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.info("[cron] Brevo API key used, still active");
}

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      fetch: (request: Request, env: Env, ctx: Ctx) =>
        // The adapter types these with @cloudflare/workers-types, which this project does not load globally.
        handle(manifest, app, request as never, env as never, ctx as never),
      scheduled: (_controller: unknown, env: Env, ctx: Ctx) => {
        ctx.waitUntil(brevoKeepAlive(env.BREVO_API_KEY));
      },
    },
  };
}
