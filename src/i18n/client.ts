// Translations for browser scripts. Base.astro embeds the strings that client code uses (collected from
// ct("…") calls into src/i18n/client-keys.json) for the page's language as JSON in #i18n-client.
// Without that element (or for German) the German text is used.
import { fill, type Vars } from "./index";

let dict: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (dict) return dict;
  try {
    dict = JSON.parse(document.getElementById("i18n-client")?.textContent || "{}");
  } catch {
    dict = {};
  }
  return dict!;
}

/** The page's language, from <html lang>. */
export function pageLang(): string {
  return document.documentElement.lang || "de";
}

/** Client-side t(): the text in the page's language, or German. */
export function ct(de: string, vars?: Vars): string {
  return fill(load()[de] ?? de, vars);
}

/** A path in the page's language: "/nachrichten/1" → "/en/nachrichten/1". */
export function clientHref(path: string): string {
  const l = pageLang();
  return l === "de" || !path.startsWith("/") || /^\/(?:api|media|_astro|images)\//.test(path) ? path : `/${l}${path}`;
}
