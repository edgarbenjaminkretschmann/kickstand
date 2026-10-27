import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { parseDate } from "../lib/dates";
import { saveProfile, setDisplayName } from "../lib/data/profiles";
import { guard, requireUser, s } from "./util";

const opt = z.string().max(200).optional();

export const profileActions = {
  save: defineAction({
    accept: "form",
    input: z.object({
      displayName: z
        .string({ required_error: "Bitte einen Anzeigenamen angeben.", invalid_type_error: "Bitte einen Anzeigenamen angeben." })
        .trim()
        .min(2, "Bitte einen Anzeigenamen angeben.")
        .max(60),
      name: opt,
      street: opt,
      zipCity: opt,
      city: opt,
      phone: opt,
      birthdate: z
        .string()
        .refine((v) => !v || parseDate(v) !== null, "Datum als TT.MM.JJJJ angeben.")
        .optional(),
      licenseNumber: opt,
      licenseClassASince: opt,
    }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await setDisplayName(user.id, s(input.displayName));
        await saveProfile(user.id, {
          name: s(input.name),
          street: s(input.street),
          zipCity: s(input.zipCity),
          city: s(input.city) || s(input.zipCity).replace(/^\d{4,5}\s*/, ""),
          phone: s(input.phone),
          birthdate: parseDate(input.birthdate),
          licenseNumber: s(input.licenseNumber),
          licenseClassASince: s(input.licenseClassASince),
        });
        return { ok: true };
      }),
  }),
};
