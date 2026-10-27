/** "1.000" / "1000,50" / "" -> number or null. */
export function parseNumber(v: string | null | undefined): number | null {
  const t = (v ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  const normalised = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}
