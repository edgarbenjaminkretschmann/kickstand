import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/auth";
import { env } from "./lib/env";

// Paths that need a logged-in member.
const PROTECTED = [/^\/app(\/|$)/, /^\/nachrichten(\/|$)/, /^\/merkliste(\/|$)/, /^\/profil(\/|$)/, /^\/anzeigen\/neu(\/|$)/, /^\/anzeigen\/[^/]+\/bearbeiten(\/|$)/];

// Public pages a shared cache may keep briefly. Only for logged-out visitors: the header shows the member.
const SHORT_CACHE = new Set(["/", "/so-gehts"]);
const SHORT_CACHE_VALUE = "public, s-maxage=60, stale-while-revalidate=600";
// Personal or changing pages: never cached anywhere.
const NO_CACHE = [/^\/anzeigen/, /^\/nachrichten/, /^\/merkliste/, /^\/profil/, /^\/app(\/|$)/, /^\/login/, /^\/registrieren/, /^\/api\//];

function withCacheHeaders(response: Response, pathname: string, loggedIn: boolean): Response {
  if (response.headers.has("Cache-Control")) return response; // endpoints that set their own (media, JSON)
  try {
    applyCacheHeader(response, pathname, loggedIn);
  } catch {
    // Response.redirect() and fetched responses have immutable headers; redirects need no caching rule.
  }
  return response;
}

function applyCacheHeader(response: Response, pathname: string, loggedIn: boolean) {
  if (SHORT_CACHE.has(pathname) && !loggedIn && response.status === 200) {
    response.headers.set("Cache-Control", SHORT_CACHE_VALUE);
    response.headers.append("Vary", "Cookie");
  } else if (NO_CACHE.some((re) => re.test(pathname)) || loggedIn) {
    response.headers.set("Cache-Control", "private, no-store");
  }
}

/**
 * The old address kickstand.<account>.workers.dev sends visitors to SITE_URL, so sessions and Google login
 * live on one origin. Preview versions (<version>-kickstand.<account>.workers.dev) are left alone.
 */
function canonicalRedirect(url: URL): Response | null {
  const site = env("SITE_URL");
  if (!site || !url.hostname.endsWith(".workers.dev") || !url.hostname.startsWith("kickstand.")) return null;
  const target = new URL(url.pathname + url.search, site);
  if (target.host === url.host) return null;
  return new Response(null, { status: 301, headers: { Location: target.toString() } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const redirect = canonicalRedirect(context.url);
  if (redirect) return redirect;

  // Static assets and public listing photos never need a session lookup.
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/images/") || pathname === "/favicon.svg" || pathname.startsWith("/media/listing/")) {
    return next();
  }

  const { user, session } = await getSession(context.request.headers);
  context.locals.user = user;
  context.locals.session = session;

  if (!user && PROTECTED.some((re) => re.test(pathname))) {
    const nextUrl = pathname + context.url.search;
    return context.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  return withCacheHeaders(await next(), pathname, !!user);
});
