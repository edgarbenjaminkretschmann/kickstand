import { isInputError } from "astro:actions";

/** Turns empty strings into null and trims, for optional text fields. */
export const blankToNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

export { parseNumber } from "./numbers";

type AnyResult = { error?: unknown } | undefined;

/** Field error messages from an action result, keyed by field name. */
export function fieldErrors(result: AnyResult): Record<string, string> {
  const out: Record<string, string> = {};
  if (result?.error && isInputError(result.error)) {
    for (const [k, v] of Object.entries(result.error.fields)) {
      if (v?.length) out[k] = v[0];
    }
  }
  return out;
}

/** A general error message for non-field errors. */
export function formError(result: AnyResult): string | null {
  const e = result?.error as { message?: string } | undefined;
  if (!e || isInputError(e)) return null;
  return e.message || "Das hat nicht geklappt. Bitte nochmal versuchen.";
}
