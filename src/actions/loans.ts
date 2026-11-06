import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { bikeFromForm, FOOTPEG_CONDITION, handoverFromForm, invalidFields, lenderFromForm, loanFromForm, loanProblems, returnFromForm, saveProblems } from "../lib/contract-form";
import { createBike, getActiveLoan, getOwnBike, listOwnBikes, matchBike, updateBike } from "../lib/data/bikes";
import {
  addPhoto,
  createLoan,
  deleteLoanCascade,
  deletePhotoRow,
  ensureProtocol,
  getOwnLoan,
  getPhotoWithLoan,
  getProtocol,
  resolveLoanLinks,
  setSignature,
  updateLoan,
  upsertProtocol,
  type ProtocolKind,
} from "../lib/data/loans";
import { tk } from "../i18n";
import { parseDate, parseTime } from "../lib/dates";
import { parseNumber } from "../lib/form";
import { deleteFile, isImageFile, saveImage } from "../lib/storage";
import { assertImageBytes } from "../lib/uploads";
import { badRequest, guard, newId, notFound, photoFiles, requireUser, s } from "./util";

const opt = z.string().max(2000).optional();
const SIG_PREFIX = "data:image/png;base64,";
const MAX_SIG_LENGTH = 600_000;

async function storePhoto(loanId: string, protocolId: string, file: File, takenAt?: Date) {
  if (!isImageFile(file)) badRequest(tk("Nur Fotos können hochgeladen werden."));
  const id = newId();
  const key = await saveImage(file, `loans/${loanId}`, id);
  const when = takenAt ?? (file.lastModified ? new Date(file.lastModified) : new Date());
  await addPhoto(id, protocolId, key, when);
  return id;
}

function checkSignature(dataUrl: string | undefined): string {
  const v = s(dataUrl);
  if (v && (!v.startsWith(SIG_PREFIX) || v.length > MAX_SIG_LENGTH)) badRequest(tk("Unterschrift ist ungültig."));
  return v;
}

const loanInput = z.object({
  loanId: z.string().optional(),
  bikeId: z.string(),
  listingId: z.string().optional(),
  conversationId: z.string().optional(),
  intent: z.enum(["draft", "finalize"]).optional(),
  borrowerName: opt,
  borrowerStreet: opt,
  borrowerZipCity: opt,
  borrowerBirthdate: opt,
  borrowerPhone: opt,
  licenseNumber: opt,
  licenseClassASince: opt,
  startDate: opt,
  startTime: opt,
  endMode: z.enum(["open", "fixed"]).optional(),
  endDate: opt,
  endTime: opt,
  latestEndDate: opt,
  returnPlace: opt,
  liabilityCapEur: opt,
  keys: z.boolean(),
  keyCount: opt,
  registration: z.boolean(),
  otherItems: opt,
  odometerKm: opt,
  fuelLevel: opt,
  damages: z.string().max(5000).optional(),
  placeDate: opt,
  sigLender: z.string().max(MAX_SIG_LENGTH).optional(),
  sigBorrower: z.string().max(MAX_SIG_LENGTH).optional(),
  photos: photoFiles,
});

const generatedInput = loanInput.omit({ bikeId: true, listingId: true, conversationId: true, intent: true, photos: true }).extend({
  liabilityChoice: opt,
  lenderName: opt,
  lenderStreet: opt,
  lenderZipCity: opt,
  make: opt,
  model: opt,
  typeCode: opt,
  plate: opt,
  vin: opt,
  firstRegistration: opt,
  powerKw: opt,
  displacementCcm: opt,
  fuel: opt,
  footpegs: z.boolean(),
  insurer: opt,
  policyNumber: opt,
  returnDate: opt,
  returnTime: opt,
  returnKm: opt,
  returnFuel: opt,
  returnDamages: z.string().max(5000).optional(),
});

export const loanActions = {
  /** Saves the contract wizard. Called debounced by JS on every change, and by the form buttons without JS. */
  save: defineAction({
    accept: "form",
    input: loanInput,
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const bike = await getOwnBike(input.bikeId, user.id);
        if (!bike) notFound(tk("Motorrad nicht gefunden."));
        // Validate before writing anything, so a rejected save leaves no half-created draft.
        const sigLender = checkSignature(input.sigLender);
        const sigBorrower = checkSignature(input.sigBorrower);
        for (const file of input.photos ?? []) {
          if (file.size > 0 && !isImageFile(file)) badRequest(tk("Nur Fotos können hochgeladen werden."));
          if (file.size > 0) await assertImageBytes(file);
        }

        let loan = input.loanId ? await getOwnLoan(input.loanId, user.id) : null;
        if (input.loanId && !loan) notFound(tk("Vertrag nicht gefunden."));
        if (loan && loan.status !== "draft") badRequest(tk("Dieser Vertrag ist schon abgeschlossen."));

        // Only link a listing/conversation of this lender about this bike. Links never change once set.
        const links =
          loan && (loan.listingId || loan.conversationId)
            ? { listingId: loan.listingId, conversationId: loan.conversationId }
            : await resolveLoanLinks(user.id, bike.id, input.listingId, input.conversationId);

        const values = { ...loanFromForm(input, bike.liabilityCapEur), ...links };

        const loanId = loan?.id ?? newId();
        if (loan) await updateLoan(loanId, values);
        else await createLoan(loanId, bike.id, user.id, values);

        const protocolId = await upsertProtocol(loanId, "handover", handoverFromForm(input));
        await setSignature(loanId, "lender", sigLender);
        await setSignature(loanId, "borrower", sigBorrower);
        for (const file of input.photos ?? []) {
          if (file.size > 0) await storePhoto(loanId, protocolId, file);
        }

        if (input.intent !== "finalize") return { loanId, status: "draft" as const, problems: [] as string[] };

        // Problems are returned (not thrown) so the page keeps the saved draft's id.
        loan = await getOwnLoan(loanId, user.id);
        const problems = loanProblems(loan!).map((p) => p.message);
        const active = await getActiveLoan(bike.id);
        if (active && active.id !== loanId) problems.push(tk("Dieses Motorrad ist gerade verliehen. Erst die Rückgabe abschließen."));
        if (problems.length) return { loanId, status: "draft" as const, problems };

        await updateLoan(loanId, { status: "active" });
        return { loanId, status: "active" as const, problems: [] as string[] };
      }),
  }),

  /**
   * "In meinem Konto speichern" on /leihvertrag: creates or updates the bike and writes the whole form as a draft.
   * The page then uploads the photos and calls `activate`, so a dropped connection leaves a draft to resume, not a
   * half-documented active loan. Problems are returned as German keys; the browser translates them.
   */
  saveGenerated: defineAction({
    accept: "form",
    input: generatedInput,
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const sigLender = checkSignature(input.sigLender);
        const sigBorrower = checkSignature(input.sigBorrower);
        const invalid = invalidFields(input);
        if (invalid.length) badRequest(invalid[0].message);

        const draft = input.loanId ? await getOwnLoan(input.loanId, user.id) : null;
        if (input.loanId && !draft) notFound(tk("Vertrag nicht gefunden."));
        if (draft && draft.status !== "draft") badRequest(tk("Dieser Vertrag ist schon abgeschlossen."));

        const form = bikeFromForm(input);
        const bike = draft ? await getOwnBike(draft.bikeId, user.id) : matchBike(await listOwnBikes(user.id), form.vin, form.plate);
        const problems = saveProblems(input).map((p) => p.message);
        const active = bike ? await getActiveLoan(bike.id) : null;
        if (active) problems.push(tk("Dieses Motorrad ist gerade verliehen. Erst die Rückgabe abschließen."));
        if (problems.length) return { loanId: null, problems };

        const loan = loanFromForm(input);
        const bikeId = bike?.id ?? newId();
        if (bike) {
          // The contract's data wins, so the saved PDF matches the signed one. Free text in Feld 22 is not ours to
          // delete: the generator only has a switch for the footpeg condition.
          const customConditions = bike.conditions && bike.conditions !== FOOTPEG_CONDITION;
          await updateBike(bikeId, {
            ...form,
            conditions: customConditions ? bike.conditions : form.conditions,
            liabilityCapEur: bike.liabilityCapEur,
            photoPath: bike.photoPath,
            lendable: bike.lendable,
          });
        } else {
          await createBike(user.id, bikeId, { ...form, liabilityCapEur: loan.liabilityCapEur, photoPath: null, lendable: false });
        }

        const lender = lenderFromForm(input);
        const values = { ...loan, lenderName: lender.name, lenderStreet: lender.street, lenderZipCity: lender.zipCity };
        const loanId = draft?.id ?? newId();
        if (draft) await updateLoan(loanId, values);
        else await createLoan(loanId, bikeId, user.id, values);

        await upsertProtocol(loanId, "handover", handoverFromForm(input));
        const ret = returnFromForm(input);
        if (ret) await upsertProtocol(loanId, "return", ret);
        await setSignature(loanId, "lender", sigLender);
        await setSignature(loanId, "borrower", sigBorrower);
        return { loanId, problems: [] as string[] };
      }),
  }),

  /** Second step of saveGenerated, after the handover photos are up: the same checks as "Abschließen" in the wizard. */
  activate: defineAction({
    accept: "form",
    input: z.object({ loanId: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const loan = await getOwnLoan(input.loanId, user.id);
        if (!loan) notFound(tk("Vertrag nicht gefunden."));
        if (loan.status !== "draft") badRequest(tk("Dieser Vertrag ist schon abgeschlossen."));
        const problems = loanProblems(loan).map((p) => p.message);
        const active = await getActiveLoan(loan.bikeId);
        if (active) problems.push(tk("Dieses Motorrad ist gerade verliehen. Erst die Rückgabe abschließen."));
        if (problems.length) return { problems };
        await updateLoan(loan.id, { status: "active" });
        return { problems };
      }),
  }),

  /** Uploads one already-resized photo (JS path). */
  uploadPhoto: defineAction({
    accept: "form",
    input: z.object({
      loanId: z.string(),
      kind: z.enum(["handover", "return"]),
      photo: z.instanceof(File),
      takenAt: z.string().optional(),
    }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const loan = await getOwnLoan(input.loanId, user.id);
        if (!loan) notFound(tk("Vertrag nicht gefunden."));
        const allowed = input.kind === "handover" ? loan.status === "draft" : loan.status === "active";
        if (!allowed) badRequest(tk("Fotos können hier nicht mehr geändert werden."));
        const protocolId = await ensureProtocol(loan.id, input.kind as ProtocolKind);
        const ms = Number(input.takenAt);
        const id = await storePhoto(loan.id, protocolId, input.photo, Number.isFinite(ms) && ms > 0 ? new Date(ms) : undefined);
        return { id, url: `/media/photo/${id}` };
      }),
  }),

  deletePhoto: defineAction({
    accept: "form",
    input: z.object({ photoId: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const row = await getPhotoWithLoan(input.photoId);
        if (!row || row.loan.lenderId !== user.id) notFound(tk("Foto nicht gefunden."));
        const allowed = row.protocol.kind === "handover" ? row.loan.status === "draft" : row.loan.status === "active";
        if (!allowed) badRequest(tk("Fotos können hier nicht mehr geändert werden."));
        await deletePhotoRow(row.photo.id);
        await deleteFile(row.photo.path);
        return { ok: true };
      }),
  }),

  /** Return protocol. Saving sets the loan to `returned`. */
  saveReturn: defineAction({
    accept: "form",
    input: z.object({
      loanId: z.string(),
      returnDate: z
        .string({ required_error: tk("Bitte das Datum angeben."), invalid_type_error: tk("Bitte das Datum angeben.") })
        .refine((v) => parseDate(v) !== null, tk("Datum als TT.MM.JJJJ angeben.")),
      returnTime: z.string().refine((v) => !v || parseTime(v) !== null, tk("Uhrzeit als HH:MM angeben.")).optional(),
      odometerKm: z.string().refine((v) => !v || parseNumber(v) !== null, tk("Bitte eine Zahl angeben.")).optional(),
      fuelLevel: opt,
      damages: z.string().max(5000).optional(),
      photos: photoFiles,
    }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const loan = await getOwnLoan(input.loanId, user.id);
        if (!loan) notFound(tk("Vertrag nicht gefunden."));
        if (loan.status !== "active") badRequest(tk("Nur laufende Leihen können zurückgegeben werden."));

        const date = parseDate(input.returnDate)!;
        if (loan.startDate && date < loan.startDate) badRequest(tk("Die Rückgabe liegt vor dem Beginn der Leihe."));
        const km = parseNumber(input.odometerKm);
        const handover = await getProtocol(loan.id, "handover");
        if (km !== null && handover?.odometerKm != null && km < handover.odometerKm) {
          badRequest(tk("Der Kilometerstand ist kleiner als bei der Übergabe."));
        }

        const protocolId = await upsertProtocol(loan.id, "return", {
          datetime: `${date}T${parseTime(input.returnTime) ?? "00:00"}`,
          odometerKm: km,
          fuelLevel: s(input.fuelLevel),
          damages: s(input.damages),
        });
        for (const file of input.photos ?? []) {
          if (file.size > 0) await storePhoto(loan.id, protocolId, file);
        }
        await updateLoan(loan.id, { status: "returned" });
        return { loanId: loan.id };
      }),
  }),

  /** Deletes a draft that was never finalised. */
  discard: defineAction({
    accept: "form",
    input: z.object({ loanId: z.string() }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const loan = await getOwnLoan(input.loanId, user.id);
        if (!loan) notFound(tk("Vertrag nicht gefunden."));
        if (loan.status !== "draft") badRequest(tk("Nur Entwürfe können gelöscht werden."));
        for (const key of await deleteLoanCascade(loan.id)) await deleteFile(key);
        return { ok: true };
      }),
  }),
};
