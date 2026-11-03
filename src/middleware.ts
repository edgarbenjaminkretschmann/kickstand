import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/auth";

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

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

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
