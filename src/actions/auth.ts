import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { signInWithEmail, signOut, signUpWithEmail, startGoogleSignIn } from "../lib/auth";
import { clientIp, hit } from "../lib/rate-limit";
import { safeNext } from "../lib/submitted";
import { guard } from "./util";

const required = (msg: string) => ({ required_error: msg, invalid_type_error: msg });

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function limitLogin(request: Request, clientAddress: string, email: string) {
  const ip = clientIp(request, clientAddress);
  if (!hit(`login:ip:${ip}`, LOGIN_LIMIT * 3, LOGIN_WINDOW_MS) || !hit(`login:email:${email.toLowerCase()}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
    throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Zu viele Anmeldeversuche. Bitte in ein paar Minuten nochmal." });
  }
}

export const authActions = {
  register: defineAction({
    accept: "form",
    input: z.object({
      name: z.string(required("Bitte deinen Namen angeben.")).trim().min(2, "Bitte deinen Namen angeben.").max(100),
      email: z.string(required("Bitte eine E-Mail angeben.")).trim().email("Bitte eine gültige E-Mail angeben."),
      password: z.string(required("Bitte ein Passwort wählen.")).min(8, "Mindestens 8 Zeichen.").max(128),
    }),
    handler: (input, context) =>
      guard(async () => {
        limitLogin(context.request, context.clientAddress, input.email);
        await signUpWithEmail(context, input);
        return { ok: true };
      }),
  }),

  login: defineAction({
    accept: "form",
    input: z.object({
      email: z.string(required("Bitte die E-Mail angeben.")).trim().email("Bitte eine gültige E-Mail angeben."),
      password: z.string(required("Bitte das Passwort angeben.")).min(1, "Bitte das Passwort angeben."),
    }),
    handler: (input, context) =>
      guard(async () => {
        limitLogin(context.request, context.clientAddress, input.email);
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
