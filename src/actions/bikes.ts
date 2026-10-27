import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { createBike, getOwnBike, updateBike } from "../lib/data/bikes";
import { parseDate } from "../lib/dates";
import { parseNumber } from "../lib/form";
import { deleteFile, isImageFile, saveImage } from "../lib/storage";
import { badRequest, guard, newId, notFound, requireUser, s } from "./util";

const req = (msg: string) => z.string({ required_error: msg, invalid_type_error: msg }).trim().min(1, msg).max(100);
const opt = z.string().max(500).optional();
// `.optional()` must be the outermost wrapper so Astro maps an empty form field to undefined.
const num = (msg: string) => z.string().refine((v) => !v || parseNumber(v) !== null, msg).optional();
const int = (v: string | undefined) => {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n);
};

export const bikeActions = {
  save: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().optional(),
      make: req("Bitte die Marke angeben."),
      model: req("Bitte das Modell angeben."),
      typeCode: opt,
      plate: opt,
      vin: opt,
      firstRegistration: z.string().refine((v) => !v || parseDate(v) !== null, "Datum als TT.MM.JJJJ angeben.").optional(),
      powerKw: num("Bitte eine Zahl angeben."),
      displacementCcm: num("Bitte eine Zahl angeben."),
      fuel: opt,
      conditions: opt,
      insurer: opt,
      policyNumber: opt,
      liabilityCapEur: num("Bitte einen Betrag angeben."),
      photo: z.instanceof(File).optional(),
      removePhoto: z.boolean(),
    }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const existing = input.id ? await getOwnBike(input.id, user.id) : null;
        if (input.id && !existing) notFound("Motorrad nicht gefunden.");

        const cap = int(input.liabilityCapEur) ?? 1000;
        if (cap < 0 || cap > 100_000) badRequest("Die Haftungsgrenze muss zwischen 0 und 100.000 € liegen.");

        const id = existing?.id ?? newId();
        let photoPath = existing?.photoPath ?? null;
        if (input.removePhoto && photoPath) {
          await deleteFile(photoPath);
          photoPath = null;
        }
        if (input.photo && input.photo.size > 0) {
          if (!isImageFile(input.photo)) badRequest("Nur Fotos können hochgeladen werden.");
          const old = photoPath;
          photoPath = await saveImage(input.photo, `bikes/${id}`, newId());
          if (old) await deleteFile(old);
        }

        const values = {
          make: s(input.make),
          model: s(input.model),
          typeCode: s(input.typeCode),
          plate: s(input.plate).toUpperCase(),
          vin: s(input.vin).toUpperCase().replace(/\s/g, ""),
          firstRegistration: parseDate(input.firstRegistration),
          powerKw: int(input.powerKw),
          displacementCcm: int(input.displacementCcm),
          fuel: s(input.fuel),
          conditions: s(input.conditions),
          insurer: s(input.insurer),
          policyNumber: s(input.policyNumber),
          liabilityCapEur: cap,
          photoPath,
          // No longer set in the form: a bike is offered by creating a listing for it.
          lendable: existing?.lendable ?? false,
        };
        if (existing) await updateBike(id, values);
        else await createBike(user.id, id, values);
        return { id };
      }),
  }),
};
