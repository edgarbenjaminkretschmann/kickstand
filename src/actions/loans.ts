import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getActiveLoan, getOwnBike } from "../lib/data/bikes";
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
import type { Loan } from "../lib/data/types";
import { parseDate, parseTime } from "../lib/dates";
import { groupThousands } from "../lib/euro-words";
import { parseNumber } from "../lib/form";
import { deleteFile, isImageFile, saveImage } from "../lib/storage";
import { badRequest, guard, newId, notFound, requireUser, s } from "./util";

const opt = z.string().max(2000).optional();
const SIG_PREFIX = "data:image/png;base64,";
const MAX_SIG_LENGTH = 600_000;

async function storePhoto(loanId: string, protocolId: string, file: File, takenAt?: Date) {
  if (!isImageFile(file)) badRequest("Nur Fotos können hochgeladen werden.");
  const id = newId();
  const key = await saveImage(file, `loans/${loanId}`, id);
  const when = takenAt ?? (file.lastModified ? new Date(file.lastModified) : new Date());
  await addPhoto(id, protocolId, key, when);
  return id;
}

function checkSignature(dataUrl: string | undefined): string {
  const v = s(dataUrl);
  if (v && (!v.startsWith(SIG_PREFIX) || v.length > MAX_SIG_LENGTH)) badRequest("Unterschrift ist ungültig.");
  return v;
}

/** Checks a loan is complete enough to become a contract. Returns German messages. */
function finalizeProblems(loan: Loan): string[] {
  const p: string[] = [];
  if (!loan.borrowerName) p.push("Name des Entleihers fehlt.");
  if (!loan.borrowerStreet || !loan.borrowerZipCity) p.push("Anschrift des Entleihers fehlt.");
  if (!loan.licenseNumber) p.push("Führerschein-Nr. fehlt.");
  if (!loan.startDate) p.push("Beginn der Leihe fehlt.");
  if (loan.endMode === "fixed") {
    if (!loan.endDate) p.push("Ende der Leihe fehlt.");
    else if (loan.startDate && loan.endDate < loan.startDate) p.push("Das Ende liegt vor dem Beginn.");
  } else {
    if (!loan.latestEndDate) p.push("Bei offener Leihe ist „spätestens am“ Pflicht.");
    else if (loan.startDate && loan.latestEndDate < loan.startDate) p.push("„Spätestens am“ liegt vor dem Beginn.");
  }
  if (!loan.returnPlace) p.push("Rückgabeort fehlt.");
  return p;
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
  photos: z.array(z.instanceof(File)).optional(),
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
        if (!bike) notFound("Motorrad nicht gefunden.");
        // Validate before writing anything, so a rejected save leaves no half-created draft.
        const sigLender = checkSignature(input.sigLender);
        const sigBorrower = checkSignature(input.sigBorrower);
        for (const file of input.photos ?? []) {
          if (file.size > 0 && !isImageFile(file)) badRequest("Nur Fotos können hochgeladen werden.");
        }

        let loan = input.loanId ? await getOwnLoan(input.loanId, user.id) : null;
        if (input.loanId && !loan) notFound("Vertrag nicht gefunden.");
        if (loan && loan.status !== "draft") badRequest("Dieser Vertrag ist schon abgeschlossen.");

        // Only link a listing/conversation of this lender about this bike. Links never change once set.
        const links =
          loan && (loan.listingId || loan.conversationId)
            ? { listingId: loan.listingId, conversationId: loan.conversationId }
            : await resolveLoanLinks(user.id, bike.id, input.listingId, input.conversationId);

        const keyCount = Math.min(9, Math.max(1, Math.round(parseNumber(input.keyCount) ?? 1)));
        const cap = parseNumber(input.liabilityCapEur);
        const values = {
          borrowerName: s(input.borrowerName),
          borrowerStreet: s(input.borrowerStreet),
          borrowerZipCity: s(input.borrowerZipCity),
          borrowerBirthdate: parseDate(input.borrowerBirthdate),
          borrowerPhone: s(input.borrowerPhone),
          licenseNumber: s(input.licenseNumber),
          licenseClassASince: s(input.licenseClassASince),
          startDate: parseDate(input.startDate),
          startTime: parseTime(input.startTime),
          endMode: input.endMode ?? "open",
          endDate: parseDate(input.endDate),
          endTime: parseTime(input.endTime),
          latestEndDate: parseDate(input.latestEndDate),
          returnPlace: s(input.returnPlace),
          liabilityCapEur: cap !== null && cap >= 0 && cap <= 100_000 ? Math.round(cap) : bike.liabilityCapEur,
          handedOverItems: { keys: input.keys, keyCount, registration: input.registration, other: s(input.otherItems) },
          placeDate: s(input.placeDate),
          ...links,
        };

        const loanId = loan?.id ?? newId();
        if (loan) await updateLoan(loanId, values);
        else await createLoan(loanId, bike.id, user.id, values);

        const protocolId = await upsertProtocol(loanId, "handover", {
          datetime: values.startDate ? `${values.startDate}T${values.startTime ?? "00:00"}` : null,
          odometerKm: parseNumber(input.odometerKm),
          fuelLevel: s(input.fuelLevel),
          damages: s(input.damages),
        });
        await setSignature(loanId, "lender", sigLender);
        await setSignature(loanId, "borrower", sigBorrower);
        for (const file of input.photos ?? []) {
          if (file.size > 0) await storePhoto(loanId, protocolId, file);
        }

        if (input.intent !== "finalize") return { loanId, status: "draft" as const, problems: [] as string[] };

        // Problems are returned (not thrown) so the page keeps the saved draft's id.
        loan = await getOwnLoan(loanId, user.id);
        const problems = finalizeProblems(loan!);
        const active = await getActiveLoan(bike.id);
        if (active && active.id !== loanId) problems.push("Dieses Motorrad ist gerade verliehen. Erst die Rückgabe abschließen.");
        if (problems.length) return { loanId, status: "draft" as const, problems };

        await updateLoan(loanId, { status: "active" });
        return { loanId, status: "active" as const, problems: [] as string[] };
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
        if (!loan) notFound("Vertrag nicht gefunden.");
        const allowed = input.kind === "handover" ? loan.status === "draft" : loan.status === "active";
        if (!allowed) badRequest("Fotos können hier nicht mehr geändert werden.");
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
        if (!row || row.loan.lenderId !== user.id) notFound("Foto nicht gefunden.");
        const allowed = row.protocol.kind === "handover" ? row.loan.status === "draft" : row.loan.status === "active";
        if (!allowed) badRequest("Fotos können hier nicht mehr geändert werden.");
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
        .string({ required_error: "Bitte das Datum angeben.", invalid_type_error: "Bitte das Datum angeben." })
        .refine((v) => parseDate(v) !== null, "Datum als TT.MM.JJJJ angeben."),
      returnTime: z.string().refine((v) => !v || parseTime(v) !== null, "Uhrzeit als HH:MM angeben.").optional(),
      odometerKm: z.string().refine((v) => !v || parseNumber(v) !== null, "Bitte eine Zahl angeben.").optional(),
      fuelLevel: opt,
      damages: z.string().max(5000).optional(),
      photos: z.array(z.instanceof(File)).optional(),
    }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        const loan = await getOwnLoan(input.loanId, user.id);
        if (!loan) notFound("Vertrag nicht gefunden.");
        if (loan.status !== "active") badRequest("Nur laufende Leihen können zurückgegeben werden.");

        const date = parseDate(input.returnDate)!;
        if (loan.startDate && date < loan.startDate) badRequest("Die Rückgabe liegt vor dem Beginn der Leihe.");
        const km = parseNumber(input.odometerKm);
        const handover = await getProtocol(loan.id, "handover");
        if (km !== null && handover?.odometerKm != null && km < handover.odometerKm) {
          badRequest(`Der Kilometerstand ist kleiner als bei der Übergabe (${groupThousands(handover.odometerKm)} km).`);
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
        if (!loan) notFound("Vertrag nicht gefunden.");
        if (loan.status !== "draft") badRequest("Nur Entwürfe können gelöscht werden.");
        for (const key of await deleteLoanCascade(loan.id)) await deleteFile(key);
        return { ok: true };
      }),
  }),
};
