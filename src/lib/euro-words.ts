// German number words for amounts on the contract, e.g. 1000 -> "eintausend".

const ONES = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
  "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

/** 1..99. `compound`: the number is a multiplier in front of "tausend", so a final 1 is "ein" not "eins". */
function belowHundred(n: number, compound: boolean): string {
  if (n < 20) return n === 1 && compound ? "ein" : ONES[n];
  const one = n % 10;
  const ten = TENS[Math.floor(n / 10)];
  return one ? `${one === 1 ? "ein" : ONES[one]}und${ten}` : ten;
}

function belowThousand(n: number, compound: boolean): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h ? `${h === 1 ? "ein" : ONES[h]}hundert` : "";
  return head + (rest ? belowHundred(rest, compound) : "");
}

/** Whole numbers 0..999 999 as one German word. */
export function numberInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError(`unsupported number: ${n}`);
  if (n === 0) return "null";
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = th ? `${th === 1 ? "ein" : belowThousand(th, true)}tausend` : "";
  return head + (rest ? belowThousand(rest, false) : "");
}

/** Euro amount in words, e.g. 1500 -> "eintausendfünfhundert Euro", 12.5 -> "zwölf Euro und fünfzig Cent". */
export function euroInWords(amount: number): string {
  const cents = Math.round(amount * 100);
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const e = `${numberInWords(euros)} Euro`;
  return rest ? `${e} und ${numberInWords(rest)} Cent` : e;
}

/** 1000 -> "1.000,00 €". Does not depend on Intl locale data. */
export function formatEuro(amount: number, withCents = true): string {
  const cents = Math.round(amount * 100);
  const euros = Math.floor(Math.abs(cents) / 100);
  const grouped = groupThousands(euros);
  const sign = cents < 0 ? "-" : "";
  const c = String(Math.abs(cents) % 100).padStart(2, "0");
  return withCents ? `${sign}${grouped},${c} €` : `${sign}${grouped} €`;
}

/** 12345 -> "12.345". */
export function groupThousands(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
