// Keeps visitors in their language. Pages are written with plain German paths (href="/anzeigen");
// for a non-German request the middleware runs the response through here, which prefixes in-site
// links, form targets and redirects (href="/en/anzeigen"). Shared paths (/media, /api, /_astro …)
// are left alone by localizePath.
import { DEFAULT_LANG, localizePath, type Lang } from "./index";

const ATTR = /\b(href|action|formaction)=(["'])(\/[^"']*)\2/g;

export function localizeHtml(html: string, lang: Lang): string {
  if (lang === DEFAULT_LANG) return html;
  return html.replace(ATTR, (_m, attr: string, q: string, url: string) => `${attr}=${q}${localizePath(url.replace(/&amp;/g, "&"), lang).replace(/&/g, "&amp;")}${q}`);
}

/** Prefixes a redirect target ("/app", "/login?next=…"). Absolute URLs to the same origin count too. */
export function localizeLocation(location: string, lang: Lang, origin: string): string {
  if (lang === DEFAULT_LANG) return location;
  if (location.startsWith(origin)) return origin + localizePath(location.slice(origin.length) || "/", lang);
  return localizePath(location, lang);
}

/** Rewrites an HTML or redirect response for `lang`. Other responses pass through untouched. */
export async function localizeResponse(response: Response, lang: Lang, origin: string): Promise<Response> {
  if (lang === DEFAULT_LANG) return response;
  const location = response.headers.get("Location");
  if (location && response.status >= 300 && response.status < 400) {
    const headers = new Headers(response.headers);
    headers.set("Location", localizeLocation(location, lang, origin));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  if (!(response.headers.get("Content-Type") ?? "").includes("text/html")) return response;
  const html = localizeHtml(await response.text(), lang);
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
