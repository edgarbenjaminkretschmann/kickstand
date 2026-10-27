import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  addListingPhoto,
  assertCanAddPhoto,
  countListingPhotos,
  createListing,
  deleteListing,
  makeCoverPhoto,
  MAX_PHOTOS,
  removeListingPhoto,
  setListingStatus,
  updateListing,
  type ListingInput,
} from "../lib/data/listings";
import { setSaved } from "../lib/data/saved";
import { parseNumber } from "../lib/form";
import { euroToCents } from "../lib/listing-format";
import { deleteFile, isImageFile, saveImage } from "../lib/storage";
import { badRequest, guard, newId, requireUser, s } from "./util";

const text = (max: number) => z.string().max(max).optional();

const listingFields = {
  type: z.string({ required_error: "Bitte Biete oder Suche wählen.", invalid_type_error: "Bitte Biete oder Suche wählen." }),
  categorySlug: z.string({ required_error: "Bitte eine Kategorie wählen.", invalid_type_error: "Bitte eine Kategorie wählen." }),
  title: z
    .string({ required_error: "Bitte einen Titel angeben.", invalid_type_error: "Bitte einen Titel angeben." })
    .trim()
    .min(3, "Bitte einen Titel angeben.")
    .max(120, "Höchstens 120 Zeichen."),
  description: text(4000),
  priceKind: text(20),
  price: z.string().refine((v) => !v || parseNumber(v) !== null, "Bitte einen Betrag angeben, z. B. 20 oder 12,50.").optional(),
  zip: text(10),
  city: text(80),
  country: text(2),
  bikeId: text(100),
  photos: z.array(z.instanceof(File)).optional(),
};

function toInput(input: { [K in keyof typeof listingFields]?: unknown }): ListingInput {
  const str = (v: unknown) => s(typeof v === "string" ? v : "");
  return {
    type: str(input.type),
    categorySlug: str(input.categorySlug),
    title: str(input.title),
    description: str(input.description),
    priceKind: str(input.priceKind) || "kostenlos",
    priceCents: euroToCents(str(input.price)),
    zip: str(input.zip),
    city: str(input.city),
    country: str(input.country).toUpperCase() || "DE",
    bikeId: str(input.bikeId) || null,
  };
}

/** Stores photos posted with the form (already shrunk by JS, or full size without JS). */
async function storePhotos(userId: string, listingId: string, files: File[] | undefined) {
  const real = (files ?? []).filter((f) => f.size > 0);
  if (!real.length) return;
  if (real.some((f) => !isImageFile(f))) badRequest("Nur Fotos können hochgeladen werden.");
  const room = MAX_PHOTOS - (await countListingPhotos(listingId));
  for (const file of real.slice(0, Math.max(0, room))) {
    await assertCanAddPhoto(userId, listingId);
    const key = await saveImage(file, `listings/${listingId}`, newId());
    await addListingPhoto(userId, listingId, key);
  }
}

export const listingActions = {
  create: defineAction({
    accept: "form",
    input: z.object(listingFields),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        if ((input.photos ?? []).some((f) => f.size > 0 && !isImageFile(f))) badRequest("Nur Fotos können hochgeladen werden.");
        const id = await createListing(user.id, toInput(input));
        await storePhotos(user.id, id, input.photos);
        return { id };
      }),
  }),

  update: defineAction({
    accept: "form",
    input: z.object({ id: z.string(), ...listingFields }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await updateListing(user.id, input.id, toInput(input));
        await storePhotos(user.id, input.id, input.photos);
        return { id: input.id };
      }),
  }),

  setStatus: defineAction({
    accept: "form",
    input: z.object({ id: z.string(), status: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await setListingStatus(user.id, input.id, input.status);
        return { id: input.id, status: input.status };
      }),
  }),

  remove: defineAction({
    accept: "form",
    input: z.object({ id: z.string(), confirm: z.string().optional() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        // The page shows a confirm step first; the second post carries confirm=ja.
        if (input.confirm !== "ja") badRequest("Bitte das Löschen bestätigen.");
        for (const key of await deleteListing(user.id, input.id)) await deleteFile(key);
        return { ok: true };
      }),
  }),

  removePhoto: defineAction({
    accept: "form",
    input: z.object({ photoId: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await deleteFile(await removeListingPhoto(user.id, input.photoId));
        return { ok: true };
      }),
  }),

  coverPhoto: defineAction({
    accept: "form",
    input: z.object({ photoId: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await makeCoverPhoto(user.id, input.photoId);
        return { ok: true };
      }),
  }),

  /** Merken / nicht mehr merken. */
  save: defineAction({
    accept: "form",
    input: z.object({ listingId: z.string(), saved: z.enum(["1", "0"]) }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const saved = await setSaved(user.id, input.listingId, input.saved === "1");
        return { listingId: input.listingId, saved };
      }),
  }),
};
