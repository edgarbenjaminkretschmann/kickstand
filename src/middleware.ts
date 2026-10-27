import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/auth";

// Paths that need a logged-in member.
const PROTECTED = [/^\/app(\/|$)/, /^\/nachrichten(\/|$)/, /^\/merkliste(\/|$)/, /^\/profil(\/|$)/, /^\/anzeigen\/neu(\/|$)/, /^\/anzeigen\/[^/]+\/bearbeiten(\/|$)/];

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

  return next();
});
