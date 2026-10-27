// The single entry point for authentication. Pages, actions and middleware use these helpers and never
// import Better Auth themselves, so the provider can be swapped (see docs/MIGRATION-GOOGLE.md).
import type { AstroCookies } from "astro";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { db } from "../../db/client";
import { Account, Session, User, Verification } from "../../db/schema";
import { ensureProfile } from "../data/profiles";

const env = (name: string): string | undefined => process.env[name] || (import.meta.env?.[name] as string | undefined) || undefined;

// Read at runtime (process.env first) so a secret present at build time is never inlined into the bundle.
const secret = env("BETTER_AUTH_SECRET");
if (!secret && import.meta.env?.PROD) {
  throw new Error("BETTER_AUTH_SECRET must be set in production");
}

const googleClientId = env("GOOGLE_CLIENT_ID");
const googleClientSecret = env("GOOGLE_CLIENT_SECRET");

/** Google login is offered only when both credentials are set. */
export const googleEnabled = !!(googleClientId && googleClientSecret);

const auth = betterAuth({
  secret: secret ?? "dev-only-secret-not-for-production-use-0000",
  baseURL: env("BETTER_AUTH_URL") ?? env("SITE_URL"),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user: User, session: Session, account: Account, verification: Verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  socialProviders: googleEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret!, prompt: "select_account" } }
    : {},
  account: {
    // A Google login with the same, verified e-mail joins the existing email+password account.
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  databaseHooks: {
    user: {
      create: {
        // Every new member (email or Google) gets a profile prefilled with the display name.
        after: async (user) => {
          await ensureProfile(user.id, user.name);
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  telemetry: { enabled: false },
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;

/** Handles /api/auth/* (OAuth callbacks, session endpoints). */
export function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request);
}

/** The signed-in user and session for a request, or nulls. */
export async function getSession(headers: Headers): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
  const result = await auth.api.getSession({ headers });
  return { user: result?.user ?? null, session: result?.session ?? null };
}

/** The current user from Astro locals (set by the middleware). */
export function getUser(context: { locals: App.Locals }): AuthUser | null {
  return context.locals.user;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Bitte zuerst anmelden.");
    this.name = "AuthRequiredError";
  }
}

/** The current user, or throws AuthRequiredError. */
export function requireUser(context: { locals: App.Locals }): AuthUser {
  const user = context.locals.user;
  if (!user) throw new AuthRequiredError();
  return user;
}

/** Copies Better Auth's Set-Cookie headers onto Astro's cookie jar. */
function applyCookies(headers: Headers, cookies: AstroCookies) {
  for (const header of headers.getSetCookie()) {
    for (const [name, attrs] of parseSetCookieHeader(header)) {
      cookies.set(name, attrs.value, toCookieOptions(attrs));
    }
  }
}

type Ctx = { request: Request; cookies: AstroCookies };

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-Mail oder Passwort stimmt nicht.",
  USER_ALREADY_EXISTS: "Diese E-Mail ist schon registriert.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Diese E-Mail ist schon registriert.",
  PASSWORD_TOO_SHORT: "Das Passwort braucht mindestens 8 Zeichen.",
  INVALID_EMAIL: "Bitte eine gültige E-Mail angeben.",
};

/** A sign-in problem with a German message for the form. */
export class AuthFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthFailure";
  }
}

function translate(e: unknown): never {
  if (e instanceof APIError) {
    const code = (e.body as { code?: string } | undefined)?.code ?? "";
    if (e.status === "TOO_MANY_REQUESTS") throw new AuthFailure("Zu viele Versuche. Bitte kurz warten.");
    throw new AuthFailure(MESSAGES[code] ?? "Anmeldung fehlgeschlagen.");
  }
  throw e;
}

export async function signUpWithEmail(ctx: Ctx, input: { name: string; email: string; password: string }): Promise<void> {
  try {
    const { headers } = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email.toLowerCase(), password: input.password },
      headers: ctx.request.headers,
      returnHeaders: true,
    });
    applyCookies(headers, ctx.cookies);
  } catch (e) {
    translate(e);
  }
}

export async function signInWithEmail(ctx: Ctx, input: { email: string; password: string }): Promise<void> {
  try {
    const { headers } = await auth.api.signInEmail({
      body: { email: input.email.toLowerCase(), password: input.password, rememberMe: true },
      headers: ctx.request.headers,
      returnHeaders: true,
    });
    applyCookies(headers, ctx.cookies);
  } catch (e) {
    translate(e);
  }
}

/**
 * Starts the Google OAuth flow. Returns the Google URL to redirect to; the state cookie is set on `ctx`.
 * `next` is where the member lands afterwards; new members go to the profile first.
 */
export async function startGoogleSignIn(ctx: Ctx, next: string): Promise<string> {
  if (!googleEnabled) throw new AuthFailure("Google-Anmeldung ist nicht eingerichtet.");
  try {
    const { headers, response } = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: next,
        newUserCallbackURL: "/profil?willkommen=1",
        errorCallbackURL: "/login?fehler=google",
        disableRedirect: true,
      },
      headers: ctx.request.headers,
      returnHeaders: true,
    });
    applyCookies(headers, ctx.cookies);
    if (!response.url) throw new AuthFailure("Google-Anmeldung fehlgeschlagen.");
    return response.url;
  } catch (e) {
    translate(e);
  }
}

export async function signOut(ctx: Ctx): Promise<void> {
  const { headers } = await auth.api.signOut({ headers: ctx.request.headers, returnHeaders: true });
  applyCookies(headers, ctx.cookies);
}
