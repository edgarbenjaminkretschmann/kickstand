// Language routing and link rewriting (src/i18n).
import { describe, expect, it } from "vitest";
import { fill, localizePath, splitLang, t } from "../src/i18n";
import { localizeHtml, localizeLocation } from "../src/i18n/links";

describe("splitLang", () => {
  it("reads the language prefix and leaves German paths alone", () => {
    expect(splitLang("/en/anzeigen")).toEqual({ lang: "en", path: "/anzeigen" });
    expect(splitLang("/pt")).toEqual({ lang: "pt", path: "/" });
    expect(splitLang("/anzeigen")).toEqual({ lang: "de", path: "/anzeigen" });
    expect(splitLang("/de/anzeigen")).toEqual({ lang: "de", path: "/de/anzeigen" }); // redirected by the middleware
    expect(splitLang("/xx/anzeigen")).toEqual({ lang: "de", path: "/xx/anzeigen" });
  });
});

describe("localizePath", () => {
  it("prefixes in-site paths for other languages", () => {
    expect(localizePath("/anzeigen?typ=biete", "fr")).toBe("/fr/anzeigen?typ=biete");
    expect(localizePath("/", "en")).toBe("/en");
    expect(localizePath("/?_action=auth.logout", "en")).toBe("/en?_action=auth.logout");
  });
  it("leaves German, shared paths, already prefixed and external URLs alone", () => {
    expect(localizePath("/anzeigen", "de")).toBe("/anzeigen");
    for (const p of ["/media/listing/1", "/api/x", "/_astro/a.js", "/images/a.webp", "/favicon.svg", "/en/app", "//evil.example", "https://x.example/"]) {
      expect(localizePath(p, "it")).toBe(p);
    }
  });
});

describe("localizeHtml / localizeLocation", () => {
  it("rewrites href, action and formaction, keeping &amp;", () => {
    const html = `<a href="/anzeigen?a=1&amp;b=2">x</a><form action="/login?_action=auth.login"><button formaction="/app">y</button></form><img src="/images/a.webp"><a href="/media/photo/1">p</a>`;
    expect(localizeHtml(html, "es")).toBe(
      `<a href="/es/anzeigen?a=1&amp;b=2">x</a><form action="/es/login?_action=auth.login"><button formaction="/es/app">y</button></form><img src="/images/a.webp"><a href="/media/photo/1">p</a>`,
    );
    expect(localizeHtml(html, "de")).toBe(html);
  });
  it("rewrites redirects, also absolute ones to the same origin", () => {
    expect(localizeLocation("/app", "en", "https://k.example")).toBe("/en/app");
    expect(localizeLocation("https://k.example/login?next=%2Fen%2Fapp", "en", "https://k.example")).toBe("https://k.example/en/login?next=%2Fen%2Fapp");
    expect(localizeLocation("https://accounts.google.com/o/oauth2", "en", "https://k.example")).toBe("https://accounts.google.com/o/oauth2");
  });
});

describe("t", () => {
  it("falls back to German and fills placeholders", () => {
    expect(t("de", "{n} ungelesen", { n: 3 })).toBe("3 ungelesen");
    expect(t("en", "Diesen Satz gibt es in keinem Wörterbuch.")).toBe("Diesen Satz gibt es in keinem Wörterbuch.");
    expect(fill("{a} und {b}", { a: 1 })).toBe("1 und {b}");
  });
});
