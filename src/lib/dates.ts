// Dates are stored as ISO strings (YYYY-MM-DD, HH:MM) and shown as DD.MM.YYYY in German, DD/MM/YYYY in the
// other languages. We never rely on the browser locale: date fields are plain text inputs parsed here.
// Functions without a `lang` argument give German, which is what the contract PDF uses.
import type { Lang } from "../i18n";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DE_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/;
const TIME = /^([01]?\d|2[0-3])[:.]?([0-5]\d)$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** Every wall-clock time Kickstand shows is German time. Servers (Workers) run in UTC, so never rely on their zone. */
export const TIME_ZONE = "Europe/Berlin";

const berlinFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Calendar date and clock time of an instant in Berlin. */
export function berlinParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const p: Record<string, string> = {};
  for (const part of berlinFormat.formatToParts(d)) p[part.type] = part.value;
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute) };
}

/** "14:05" for an instant, in Berlin time. */
export function berlinTime(d: Date = new Date()): string {
  const b = berlinParts(d);
  return `${pad(b.hour)}:${pad(b.minute)}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}

/** Separator between day, month and year: "23.10.2026" in German, "23/10/2026" elsewhere. */
const dateSep = (lang: Lang) => (lang === "de" ? "." : "/");

/** "2026-10-23" -> "23.10.2026" (en: "23/10/2026"). Returns "" for empty input and the input itself if it is not ISO. */
export function formatDate(value: string | null | undefined, lang: Lang = "de"): string {
  if (!value) return "";
  const m = ISO_DATE.exec(value.slice(0, 10));
  const sep = dateSep(lang);
  return m ? `${m[3]}${sep}${m[2]}${sep}${m[1]}` : value;
}

/** "14:05" -> "14:05 Uhr" in German, unchanged elsewhere. */
const clock = (time: string, lang: Lang) => (lang === "de" ? `${time} Uhr` : time);

/** "2026-10-23T14:05" or ("2026-10-23", "14:05") -> "23.10.2026, 14:05 Uhr" (en: "23/10/2026, 14:05"). */
export function formatDateTime(date: string | null | undefined, time?: string | null, lang: Lang = "de"): string {
  if (date && !time && date.length > 10) {
    time = date.slice(11, 16);
    date = date.slice(0, 10);
  }
  return [formatDate(date, lang), time ? clock(time, lang) : ""].filter(Boolean).join(", ");
}

/** A Date (or epoch ms) in Berlin time -> "23.10.2026, 14:05 Uhr" (en: "23/10/2026, 14:05"). */
export function formatTimestamp(value: Date | number | string, lang: Lang = "de"): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const b = berlinParts(d);
  const sep = dateSep(lang);
  return `${pad(b.day)}${sep}${pad(b.month)}${sep}${b.year}, ${clock(`${pad(b.hour)}:${pad(b.minute)}`, lang)}`;
}

/**
 * Parses what a person types into a date field. Accepts "23.10.2026", "23/10/2026", "1.2.26" and ISO "2026-10-23".
 * Returns ISO "YYYY-MM-DD", or null if empty or invalid.
 */
export function parseDate(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const iso = ISO_DATE.exec(v);
  const de = DE_DATE.exec(v);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (de) {
    [d, m, y] = [Number(de[1]), Number(de[2]), Number(de[3])];
    if (de[3].length === 2) y += y > 50 ? 1900 : 2000;
  } else {
    return null;
  }
  if (!isValidYmd(y, m, d)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "9:05" / "09.05" / "905" / "0905" -> "09:05". "9:5" is invalid. Returns null if empty or invalid. */
export function parseTime(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  const m = TIME.exec(v);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null;
}

/** Today as ISO date in Berlin. */
export function todayIso(now: Date = new Date()): string {
  const b = berlinParts(now);
  return `${b.year}-${pad(b.month)}-${pad(b.day)}`;
}

/** Adds days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
