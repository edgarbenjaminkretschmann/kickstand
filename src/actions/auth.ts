import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { signInWithEmail, signOut, signUpWithEmail, startGoogleSignIn } from "../lib/auth";
import { allow, clientIp, RULES } from "../lib/rate-limit";
import { safeNext } from "../lib/submitted";
import { guard } from "./util";
import { tk } from "../i18n";

const required = (msg: string) => ({ required_error: msg, invalid_type_error: msg });

async function limitLogin(request: Request, clientAddress: string, email: string) {
  const ip = clientIp(request, clientAddress);
  if (!(await allow(RULES.loginIp, ip)) || !(await allow(RULES.loginEmail, email.toLowerCase()))) {
    throw new ActionError({ code: "TOO_MANY_REQUESTS", message: tk("Zu viele Anmeldeversuche. Bitte in ein paar Minuten nochmal.") });
  }
}

export const authActions = {
  register: defineAction({
    accept: "form",
    input: z.object({
      name: z.string(required(tk("Bitte deinen Namen angeben."))).trim().min(2, tk("Bitte deinen Namen angeben.")).max(100),
      email: z.string(required(tk("Bitte eine E-Mail angeben."))).trim().email(tk("Bitte eine gültige E-Mail angeben.")),
      password: z.string(required(tk("Bitte ein Passwort wählen."))).min(8, tk("Mindestens 8 Zeichen.")).max(128),
    }),
    handler: (input, context) =>
      guard(async () => {
        await limitLogin(context.request, context.clientAddress, input.email);
        await signUpWithEmail(context, input);
        return { ok: true };
      }),
  }),

  login: defineAction({
    accept: "form",
    input: z.object({
      email: z.string(required(tk("Bitte die E-Mail angeben."))).trim().email(tk("Bitte eine gültige E-Mail angeben.")),
      password: z.string(required(tk("Bitte das Passwort angeben."))).min(1, tk("Bitte das Passwort angeben.")),
    }),
    handler: (input, context) =>
      guard(async () => {
        await limitLogin(context.request, context.clientAddress, input.email);
        await signInWithEmail(context, input);
        return { ok: true };
      }),
  }),

  /** Starts Google OAuth. The page redirects to the returned URL. */
  google: defineAction({
    accept: "form",
    input: z.object({ next: z.string().optional() }),
    handler: (input, context) =>
      guard(async () => {
        const url = await startGoogleSignIn(context, safeNext(input.next));
        return { url };
      }),
  }),

  logout: defineAction({
    accept: "form",
    handler: (_input, context) =>
      guard(async () => {
        await signOut(context);
        return { ok: true };
      }),
  }),
};
