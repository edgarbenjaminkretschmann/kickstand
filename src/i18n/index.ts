// Languages. German is the source language and lives at the plain URLs (/anzeigen); every other language
// gets a prefix (/en/anzeigen). The middleware strips the prefix, sets `locals.lang` and renders the same
// page, then puts the prefix back on links and redirects (src/i18n/links.ts).
//
// Texts are looked up by their German wording: t(lang, "Anzeige aufgeben") → "Post a listing".
// A missing translation falls back to German, so nothing ever shows a key. `npm run i18n:keys` collects
// every t("…") / tk("…") / ct("…") string into src/i18n/keys.json, the list the translations follow.
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";

export const LANGS = ["de", "en", "fr", "es", "it", "pt"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "de";

/** Name of each language in itself, for the switcher. */
export const LANG_NAMES: Record<Lang, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

/** BCP 47 tags for Intl formatting and <html lang>. */
export const LOCALE_TAG: Record<Lang, string> = {
  de: "de-DE",
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
};

const DICTS: Record<Exclude<Lang, "de">, Record<string, string>> = { en, fr, es, it, pt };

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

export type Vars = Record<string, string | number>;

/** Replaces {name} placeholders. */
export function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The text in `lang`, or the German original if there is no translation. */
export function t(lang: Lang, de: string, vars?: Vars): string {
  const text = lang === "de" ? de : (DICTS[lang][de] ?? de);
  return fill(text, vars);
}

/**
 * Marks a German string as translatable without translating it now: server messages (action errors,
 * labels from the database) are stored or thrown in German and translated where they are shown,
 * with t(lang, message). The key collector picks up tk("…") like t("…").
 */
export function tk(de: string): string {
  return de;
}

/** Translator bound to one language, for templates: const { t } = i18n(Astro.locals.lang). */
export function i18n(lang: Lang | undefined) {
  const l = lang ?? DEFAULT_LANG;
  return {
    lang: l,
    tag: LOCALE_TAG[l],
    t: (de: string, vars?: Vars) => t(l, de, vars),
    /** A path in this language: "/anzeigen" → "/en/anzeigen". */
    href: (path: string) => localizePath(path, l),
  };
}

/** "/en/anzeigen?x=1" → { lang: "en", path: "/anzeigen?x=1" }. Paths without a prefix are German. */
export function splitLang(pathname: string): { lang: Lang; path: string } {
  const m = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (m && m[1] !== DEFAULT_LANG && isLang(m[1])) return { lang: m[1], path: m[2] || "/" };
  return { lang: DEFAULT_LANG, path: pathname };
}

/** Paths that are the same in every language (files, media, API, auth callbacks). */
const SHARED = /^\/(?:_astro|_actions|_image|images|media|api|favicon\.svg|robots\.txt)(?:[/?#]|$)/;

/** Adds the language prefix to an absolute in-site path. German, shared paths and other URLs stay as they are. */
export function localizePath(path: string, lang: Lang): string {
  if (lang === DEFAULT_LANG || !path.startsWith("/") || path.startsWith("//") || SHARED.test(path)) return path;
  if (splitLang(path.split(/[?#]/)[0]).lang !== DEFAULT_LANG) return path; // already prefixed
  return path === "/" ? `/${lang}` : path.startsWith("/?") || path.startsWith("/#") ? `/${lang}${path.slice(1)}` : `/${lang}${path}`;
}
