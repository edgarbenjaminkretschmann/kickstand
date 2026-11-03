// Display helpers for listings. Pure, so they run anywhere and are easy to test.
// The label maps hold German text (the translation key); show them with t(lang, LABEL[x]).
// The functions take an optional language, German by default.
import { LOCALE_TAG, t, tk, type Lang } from "../i18n";
import { berlinParts, TIME_ZONE } from "./dates";
import { parseNumber } from "./numbers";

export const TYPE_LABEL: Record<string, string> = { biete: tk("Biete"), suche: tk("Suche") };
export const STATUS_LABEL: Record<string, string> = { aktiv: tk("Aktiv"), reserviert: tk("Reserviert"), erledigt: tk("Erledigt") };
export const PRICE_KIND_LABEL: Record<string, string> = {
  kostenlos: tk("Kostenlos"),
  tausch: tk("Tausch"),
  preis: tk("Festpreis"),
  vb: tk("Verhandlungsbasis"),
};
export const COUNTRY_LABEL: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", PT: "Portugal", ES: "Spanien" };

/** Country name in `lang` ("PT" → "Portugal", "Portugal" in English too, "Portogallo" in Italian). */
export function countryName(code: string, lang: Lang = "de"): string {
  if (lang === "de") return COUNTRY_LABEL[code] ?? code;
  try {
    return new Intl.DisplayNames([LOCALE_TAG[lang]], { type: "region" }).of(code) ?? code;
  } catch {
    return COUNTRY_LABEL[code] ?? code;
  }
}

/** Cents -> "12 €" / "12,50 €". */
export function formatCents(cents: number, lang: Lang = "de"): string {
  const whole = cents % 100 === 0;
  return `${new Intl.NumberFormat(LOCALE_TAG[lang], { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100)} €`;
}

/** The price line on a card: "Kostenlos", "Tausch", "20 €", "20 € VB", "VB". */
export function priceLabel(kind: string, cents: number | null | undefined, lang: Lang = "de"): string {
  if (kind === "kostenlos") return t(lang, "Kostenlos");
  if (kind === "tausch") return t(lang, "Tausch");
  if (kind === "vb") return cents ? t(lang, "{price} VB", { price: formatCents(cents, lang) }) : t(lang, "VB");
  return cents ? formatCents(cents, lang) : t(lang, "Preis auf Anfrage");
}

/** Cents -> value for the price input ("12,50"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

/** "120" / "120,50" / "1.200" -> cents, or null. */
export function euroToCents(v: string | null | undefined): number | null {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n * 100);
}

/** "heute", "gestern", "vor 3 Tagen", "vor 2 Wochen", then the date. */
export function relativeDate(date: Date, now: Date = new Date(), lang: Lang = "de"): string {
  // Calendar days in Berlin, so "gestern" flips at German midnight, not at UTC midnight.
  const day = (d: Date) => {
    const b = berlinParts(d);
    return Date.UTC(b.year, b.month - 1, b.day);
  };
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days <= 0) return t(lang, "heute");
  if (days === 1) return t(lang, "gestern");
  if (days < 14) return t(lang, "vor {n} Tagen", { n: days });
  if (days < 60) return t(lang, "vor {n} Wochen", { n: Math.floor(days / 7) });
  const pad = (n: number) => String(n).padStart(2, "0");
  const b = berlinParts(date);
  const sep = lang === "de" ? "." : "/";
  return t(lang, "am {date}", { date: `${pad(b.day)}${sep}${pad(b.month)}${sep}${b.year}` });
}

/** "Mitglied seit März 2024". */
export function memberSince(date: Date, lang: Lang = "de"): string {
  const when = new Intl.DateTimeFormat(LOCALE_TAG[lang], { month: "long", year: "numeric", timeZone: TIME_ZONE }).format(date);
  return t(lang, "Mitglied seit {date}", { date: when });
}

/** "12345 Musterstadt" / "Lissabon, Portugal". */
export function placeLabel(l: { zip: string; city: string; country: string }, lang: Lang = "de"): string {
  const place = [l.zip, l.city].filter(Boolean).join(" ");
  return l.country && l.country !== "DE" ? `${place}, ${countryName(l.country, lang)}` : place;
}
