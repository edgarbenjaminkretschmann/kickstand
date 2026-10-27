// Dates are stored as ISO strings (YYYY-MM-DD, HH:MM) and always shown as DD.MM.YYYY.
// We never rely on the browser locale: date fields are plain text inputs parsed here.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DE_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/;
const TIME = /^([01]?\d|2[0-3])[:.]?([0-5]\d)$/;

const pad = (n: number) => String(n).padStart(2, "0");

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}

/** "2026-10-23" -> "23.10.2026". Returns "" for empty input and the input itself if it is not ISO. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const m = ISO_DATE.exec(value.slice(0, 10));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
}

/** "2026-10-23T14:05" or ("2026-10-23", "14:05") -> "23.10.2026, 14:05 Uhr". */
export function formatDateTime(date: string | null | undefined, time?: string | null): string {
  if (date && !time && date.length > 10) {
    time = date.slice(11, 16);
    date = date.slice(0, 10);
  }
  return [formatDate(date), time ? `${time} Uhr` : ""].filter(Boolean).join(", ");
}

/** A Date (or epoch ms) in local time -> "23.10.2026, 14:05 Uhr". */
export function formatTimestamp(value: Date | number | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

/**
 * Parses what a person types into a date field. Accepts "23.10.2026", "1.2.26" and ISO "2026-10-23".
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

/** Today as ISO date in local time. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Adds days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
