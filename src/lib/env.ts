// The one place that reads configuration. On Workers, vars, secrets and bindings only exist while a
// request runs, so everything here is read lazily, never at import time. On Node (dev, tests, Docker)
// the values come from process.env and Astro's .env loading. The platform decides via "#platform".
import { readBinding, readVar } from "#platform";

/** A plain var or secret, or undefined when it is missing or empty. */
export function env(name: string): string | undefined {
  const v = readVar(name);
  return typeof v === "string" && v !== "" ? v : undefined;
}

/** A Workers binding (R2 bucket, rate limiter, ...). Always undefined on Node. */
export function binding<T>(name: string): T | undefined {
  return (readBinding(name) as T | undefined) ?? undefined;
}

/** True in a production build (astro build), false in astro dev and Vitest. */
export const isProd = !!import.meta.env?.PROD;
