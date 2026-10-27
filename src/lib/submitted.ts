/**
 * After a failed form action, re-read what was posted so the form can be shown again with the
 * person's input instead of empty fields. Astro hands the action a clone, so the body is still readable.
 */
export async function submittedValues(request: Request, failed: boolean): Promise<Record<string, string> | null> {
  if (!failed || request.method !== "POST") return null;
  try {
    const fd = await request.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of fd) if (typeof v === "string") out[k] = v;
    return out;
  } catch {
    return null;
  }
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
