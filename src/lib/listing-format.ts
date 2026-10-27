// Display helpers for listings. Pure, so they run anywhere and are easy to test.
import { parseNumber } from "./numbers";

export const TYPE_LABEL: Record<string, string> = { biete: "Biete", suche: "Suche" };
export const STATUS_LABEL: Record<string, string> = { aktiv: "Aktiv", reserviert: "Reserviert", erledigt: "Erledigt" };
export const PRICE_KIND_LABEL: Record<string, string> = {
  kostenlos: "Kostenlos",
  tausch: "Tausch",
  preis: "Festpreis",
  vb: "Verhandlungsbasis",
};
export const COUNTRY_LABEL: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", PT: "Portugal", ES: "Spanien" };

/** Cents -> "12 €" / "12,50 €". */
export function formatCents(cents: number): string {
  const whole = cents % 100 === 0;
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100)} €`;
}

/** The price line on a card: "Kostenlos", "Tausch", "20 €", "20 € VB", "VB". */
export function priceLabel(kind: string, cents: number | null | undefined): string {
  if (kind === "kostenlos") return "Kostenlos";
  if (kind === "tausch") return "Tausch";
  if (kind === "vb") return cents ? `${formatCents(cents)} VB` : "VB";
  return cents ? formatCents(cents) : "Preis auf Anfrage";
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
export function relativeDate(date: Date, now: Date = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 14) return `vor ${days} Tagen`;
  if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `am ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** "Mitglied seit März 2024". */
export function memberSince(date: Date): string {
  return `Mitglied seit ${new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(date)}`;
}

/** "12345 Musterstadt" / "Lissabon, Portugal". */
export function placeLabel(l: { zip: string; city: string; country: string }): string {
  const place = [l.zip, l.city].filter(Boolean).join(" ");
  return l.country && l.country !== "DE" ? `${place}, ${COUNTRY_LABEL[l.country] ?? l.country}` : place;
}
