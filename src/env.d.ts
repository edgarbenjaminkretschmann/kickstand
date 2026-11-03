/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: import("./lib/auth").AuthUser | null;
    session: import("./lib/auth").AuthSession | null;
    /** UI language from the URL prefix (German without prefix). Set by the middleware. */
    lang: import("./i18n").Lang;
  }
}

interface ImportMetaEnv {
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly SITE_URL?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly UPLOAD_DIR?: string;
  readonly DATABASE_URL?: string;
}
