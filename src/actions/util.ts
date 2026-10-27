import { ActionError, type ActionAPIContext } from "astro:actions";
import { AuthFailure, AuthRequiredError, requireUser as requireAuthUser } from "../lib/auth";
import { DataError } from "../lib/data/errors";

export function requireUser(context: ActionAPIContext) {
  try {
    return requireAuthUser(context);
  } catch {
    throw new ActionError({ code: "UNAUTHORIZED", message: "Bitte zuerst anmelden." });
  }
}

export function notFound(message = "Nicht gefunden."): never {
  throw new ActionError({ code: "NOT_FOUND", message });
}

export function badRequest(message: string): never {
  throw new ActionError({ code: "BAD_REQUEST", message });
}

/** Runs a handler and turns data-layer and auth errors into ActionErrors with their German message. */
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DataError) throw new ActionError({ code: e.code, message: e.message });
    if (e instanceof AuthFailure) throw new ActionError({ code: "BAD_REQUEST", message: e.message });
    if (e instanceof AuthRequiredError) throw new ActionError({ code: "UNAUTHORIZED", message: e.message });
    throw e;
  }
}

export { newId } from "../lib/data/errors";

/** Plain string from an optional form field. */
export const s = (v: string | null | undefined) => (v ?? "").trim();
