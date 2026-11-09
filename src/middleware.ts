import { defineMiddleware } from "astro:middleware";
import { splitLang } from "./i18n";
import { localizeResponse } from "./i18n/links";
import { getSession } from "./lib/auth";
import { env } from "./lib/env";

// Paths that need a logged-in member.
const PROTECTED = [/^\/app(\/|$)/, /^\/nachrichten(\/|$)/, /^\/merkliste(\/|$)/, /^\/profil(\/|$)/, /^\/anzeigen\/neu(\/|$)/, /^\/anzeigen\/[^/]+\/bearbeiten(\/|$)/];

// Public pages a shared cache may keep briefly. Only for logged-out visitors: the header shows the member.
const SHORT_CACHE = new Set(["/", "/so-gehts", "/leihvertrag"]);
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
 * Old and alias addresses send visitors to SITE_URL, so sessions and Google login live on one origin:
 * kickstand.<account>.workers.dev and every host in REDIRECT_HOSTS (comma-separated, e.g. www. and the
 * former domain). Preview versions (<version>-kickstand.<account>.workers.dev) and localhost are left alone.
 */
function canonicalRedirect(url: URL): Response | null {
  const site = env("SITE_URL");
  if (!site) return null;
  const aliases = (env("REDIRECT_HOSTS") ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const oldWorkersDev = url.hostname.endsWith(".workers.dev") && url.hostname.startsWith("kickstand.");
  if (!oldWorkersDev && !aliases.includes(url.hostname.toLowerCase())) return null;
  const target = new URL(url.pathname + url.search, site);
  if (target.host === url.host) return null;
  return new Response(null, { status: 301, headers: { Location: target.toString() } });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const redirect = canonicalRedirect(context.url);
  if (redirect) return redirect;

  // "/de/…" is the language switcher's way to say "German": send it to the plain URL.
  const de = /^\/de(\/.*)?$/.exec(context.url.pathname);
  if (de) return context.redirect((de[1] || "/") + context.url.search, 302);

  // "/en/anzeigen" renders the page at "/anzeigen" with locals.lang = "en" (see src/i18n).
  const { lang, path: pathname } = splitLang(context.url.pathname);
  context.locals.lang = lang;
  const render = () => (lang === "de" ? next() : next(new URL(pathname + context.url.search, context.url)));

  // Static assets and public listing photos never need a session lookup.
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/images/") || pathname === "/favicon.svg" || pathname.startsWith("/media/listing/")) {
    return next();
  }

  const { user, session } = await getSession(context.request.headers);
  context.locals.user = user;
  context.locals.session = session;

  if (!user && PROTECTED.some((re) => re.test(pathname))) {
    const nextUrl = context.url.pathname + context.url.search;
    return localizeResponse(context.redirect(`/login?next=${encodeURIComponent(nextUrl)}`), lang, context.url.origin);
  }

  const response = withCacheHeaders(await render(), pathname, !!user);
  return localizeResponse(response, lang, context.url.origin);
});
