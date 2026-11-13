// Fallback cover for listings without an uploaded photo: one of our own tour photos, picked per category
// and spread over the pool by listing id, so neighbouring cards don't all show the same picture.
// Shown with a "Symbolbild" label so nobody takes it for the actual item.

const POOL: Record<string, string[]> = {
  "motorrad-leihen": ["gs1200-2026-parkplatz", "gs1200-2026-koffer", "gs1200-2026-front", "myanmar-2017-strand-bike"],
  garage: ["gs1200-2026-heck", "gs1200-2026-parkplatz"],
  werkzeug: ["unterwegs-werkstatt"],
  teile: ["unterwegs-werkstatt", "gs1200-2026-front"],
  hilfe: ["unterwegs-werkstatt"],
  tour: ["alpen-2018-pass", "portugal-2021-kueste", "vietnam-2014-nebelpass", "alpen-2018-kurve", "indien-2024-serpentine"],
  sonstiges: ["unterwegs-aussicht", "unterwegs-weite", "unterwegs-pause"],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** URL of the 640px stock photo for a listing without its own photo. */
export function stockPhoto(categorySlug: string, listingId: string): string {
  const pool = POOL[categorySlug] ?? POOL.sonstiges;
  return `/images/touren/${pool[hash(listingId) % pool.length]}-640.webp`;
}
