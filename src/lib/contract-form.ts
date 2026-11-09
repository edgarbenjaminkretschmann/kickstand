// From form fields to contract data, in one place. The public generator (/leihvertrag) runs this in the browser,
// the account actions run it on the server, so a saved contract matches the PDF that was signed.
// Pure and light: the jsPDF import below is type-only, so this file never pulls jsPDF into a page.
import type { ContractBike, ContractData, ContractLoan, ContractPerson, ContractPhoto, ContractProtocol, ContractSignature } from "./contract-pdf";
import { parseDate, parseTime } from "./dates";
import { parseNumber } from "./numbers";

/**
 * Marks a German message for the key collector, like ct() in browser scripts: these messages are shown by the
 * generator in the browser, so they must reach the embedded dictionary. Not imported from src/i18n, which would
 * bundle every language.
 */
const ct = (de: string) => de;

/** Feld 22 switch of the generator. The contract then carries the Beifahrer sentence in § 4 Abs. 3. */
export const FOOTPEG_CONDITION = "Beifahrer nur mit Fußrasten";

export const MAX_CAP_EUR = 100_000;
const DEFAULT_CAP_EUR = 1000;

/** Field names as both contract forms post them. Text stays as typed; checkboxes are booleans. */
export interface LoanFormValues {
  borrowerName?: string;
  borrowerStreet?: string;
  borrowerZipCity?: string;
  borrowerBirthdate?: string;
  borrowerPhone?: string;
  licenseNumber?: string;
  licenseClassASince?: string;
  startDate?: string;
  startTime?: string;
  endMode?: string;
  endDate?: string;
  endTime?: string;
  latestEndDate?: string;
  returnPlace?: string;
  /** "500" | "1000" | "1500" | "other". Without it (wizard), liabilityCapEur is the amount. */
  liabilityChoice?: string;
  liabilityCapEur?: string;
  keys?: boolean;
  keyCount?: string;
  registration?: boolean;
  otherItems?: string;
  odometerKm?: string;
  fuelLevel?: string;
  damages?: string;
  placeDate?: string;
}

/** The generator's extra fields: it also asks for the lender, the bike and the return. */
export interface ContractFormValues extends LoanFormValues {
  lenderName?: string;
  lenderStreet?: string;
  lenderZipCity?: string;
  make?: string;
  model?: string;
  typeCode?: string;
  plate?: string;
  vin?: string;
  firstRegistration?: string;
  powerKw?: string;
  displacementCcm?: string;
  fuel?: string;
  footpegs?: boolean;
  insurer?: string;
  policyNumber?: string;
  returnDate?: string;
  returnTime?: string;
  returnKm?: string;
  returnFuel?: string;
  returnDamages?: string;
}

export interface FormProblem {
  field: string;
  /** German; translate where it is shown. */
  message: string;
}

const text = (v: string | null | undefined) => (v ?? "").trim();

function wholeNumber(v: string | undefined): number | null {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n);
}

/** The chosen liability cap in whole euros, or null if the amount is not usable. */
export function capFromForm(v: LoanFormValues): number | null {
  const raw = v.liabilityChoice && v.liabilityChoice !== "other" ? v.liabilityChoice : v.liabilityCapEur;
  const cap = parseNumber(raw);
  return cap !== null && cap >= 0 && cap <= MAX_CAP_EUR ? Math.round(cap) : null;
}

export function loanFromForm(v: LoanFormValues, fallbackCap = DEFAULT_CAP_EUR) {
  return {
    borrowerName: text(v.borrowerName),
    borrowerStreet: text(v.borrowerStreet),
    borrowerZipCity: text(v.borrowerZipCity),
    borrowerBirthdate: parseDate(v.borrowerBirthdate),
    borrowerPhone: text(v.borrowerPhone),
    licenseNumber: text(v.licenseNumber),
    licenseClassASince: text(v.licenseClassASince),
    startDate: parseDate(v.startDate),
    startTime: parseTime(v.startTime),
    endMode: v.endMode === "fixed" ? "fixed" : "open",
    endDate: parseDate(v.endDate),
    endTime: parseTime(v.endTime),
    latestEndDate: parseDate(v.latestEndDate),
    returnPlace: text(v.returnPlace),
    liabilityCapEur: capFromForm(v) ?? fallbackCap,
    handedOverItems: {
      keys: !!v.keys,
      keyCount: Math.min(9, Math.max(1, Math.round(parseNumber(v.keyCount) ?? 1))),
      registration: !!v.registration,
      other: text(v.otherItems),
    },
    placeDate: text(v.placeDate),
  } satisfies ContractLoan;
}

/** "2026-10-23T14:05", or just the date when no time was given, so no made-up "00:00 Uhr" lands in the protocol. */
function protocolDatetime(date: string | null, time: string | null): string | null {
  return date && time ? `${date}T${time}` : date;
}

export function handoverFromForm(v: LoanFormValues) {
  return {
    datetime: protocolDatetime(parseDate(v.startDate), parseTime(v.startTime)),
    odometerKm: parseNumber(v.odometerKm),
    fuelLevel: text(v.fuelLevel),
    damages: text(v.damages),
  } satisfies ContractProtocol;
}

/** The return protocol, or null while its fields are all empty. */
export function returnFromForm(v: ContractFormValues) {
  const p = {
    datetime: protocolDatetime(parseDate(v.returnDate), parseTime(v.returnTime)),
    odometerKm: parseNumber(v.returnKm),
    fuelLevel: text(v.returnFuel),
    damages: text(v.returnDamages),
  } satisfies ContractProtocol;
  return p.datetime || p.odometerKm !== null || p.fuelLevel || p.damages ? p : null;
}

export function bikeFromForm(v: ContractFormValues) {
  return {
    make: text(v.make),
    model: text(v.model),
    typeCode: text(v.typeCode),
    plate: text(v.plate).toUpperCase(),
    vin: text(v.vin).toUpperCase().replace(/\s/g, ""),
    firstRegistration: parseDate(v.firstRegistration),
    powerKw: wholeNumber(v.powerKw),
    displacementCcm: wholeNumber(v.displacementCcm),
    fuel: text(v.fuel),
    conditions: v.footpegs ? FOOTPEG_CONDITION : "",
    insurer: text(v.insurer),
    policyNumber: text(v.policyNumber),
  } satisfies ContractBike;
}

export function lenderFromForm(v: ContractFormValues) {
  return { name: text(v.lenderName), street: text(v.lenderStreet), zipCity: text(v.lenderZipCity) } satisfies ContractPerson;
}

/** What buildContractPdf() needs, from the generator's form plus what only lives in the browser's memory. */
export function contractDataFromForm(
  v: ContractFormValues,
  media: {
    photos?: { handover?: ContractPhoto[]; return?: ContractPhoto[] };
    signatures?: { lender?: ContractSignature | null; borrower?: ContractSignature | null };
  } = {},
): ContractData {
  return {
    loan: loanFromForm(v),
    bike: bikeFromForm(v),
    lender: lenderFromForm(v),
    protocols: { handover: handoverFromForm(v), return: returnFromForm(v) },
    photos: { handover: media.photos?.handover ?? [], return: media.photos?.return ?? [] },
    signatures: { lender: media.signatures?.lender ?? null, borrower: media.signatures?.borrower ?? null },
  };
}

const DATE_FIELDS: (keyof ContractFormValues)[] = ["firstRegistration", "borrowerBirthdate", "startDate", "endDate", "latestEndDate", "returnDate"];
const TIME_FIELDS: (keyof ContractFormValues)[] = ["startTime", "endTime", "returnTime"];
const NUMBER_FIELDS: (keyof ContractFormValues)[] = ["powerKw", "displacementCcm", "odometerKm", "returnKm"];

/** Typed but unusable values. These would silently vanish from the contract, so they always block. */
export function invalidFields(v: ContractFormValues): FormProblem[] {
  const out: FormProblem[] = [];
  const filled = (k: keyof ContractFormValues) => text(v[k] as string | undefined);
  for (const k of DATE_FIELDS) if (filled(k) && !parseDate(filled(k))) out.push({ field: k, message: ct("Datum als TT.MM.JJJJ angeben.") });
  for (const k of TIME_FIELDS) if (filled(k) && !parseTime(filled(k))) out.push({ field: k, message: ct("Uhrzeit als HH:MM angeben.") });
  for (const k of NUMBER_FIELDS) if (filled(k) && parseNumber(filled(k)) === null) out.push({ field: k, message: ct("Bitte eine Zahl angeben.") });
  if (capFromForm(v) === null) out.push({ field: "liabilityCapEur", message: ct("Die Haftungsgrenze muss zwischen 0 und 100.000 € liegen.") });
  return out;
}

/** The rules for a loan to become active. German messages. */
export function loanProblems(
  loan: Pick<
    ContractLoan,
    "borrowerName" | "borrowerStreet" | "borrowerZipCity" | "licenseNumber" | "startDate" | "endMode" | "endDate" | "latestEndDate" | "returnPlace"
  >,
): FormProblem[] {
  const p: FormProblem[] = [];
  if (!loan.borrowerName) p.push({ field: "borrowerName", message: ct("Name des Entleihers fehlt.") });
  if (!loan.borrowerStreet || !loan.borrowerZipCity) p.push({ field: "borrowerStreet", message: ct("Anschrift des Entleihers fehlt.") });
  if (!loan.licenseNumber) p.push({ field: "licenseNumber", message: ct("Führerschein-Nr. fehlt.") });
  if (!loan.startDate) p.push({ field: "startDate", message: ct("Beginn der Leihe fehlt.") });
  if (loan.endMode === "fixed") {
    if (!loan.endDate) p.push({ field: "endDate", message: ct("Ende der Leihe fehlt.") });
    else if (loan.startDate && loan.endDate < loan.startDate) p.push({ field: "endDate", message: ct("Das Ende liegt vor dem Beginn.") });
  } else {
    if (!loan.latestEndDate) p.push({ field: "latestEndDate", message: ct("Bei offener Leihe ist „spätestens am“ Pflicht.") });
    else if (loan.startDate && loan.latestEndDate < loan.startDate) p.push({ field: "latestEndDate", message: ct("„Spätestens am“ liegt vor dem Beginn.") });
  }
  if (!loan.returnPlace) p.push({ field: "returnPlace", message: ct("Rückgabeort fehlt.") });
  return p;
}

function partyAndBikeProblems(v: ContractFormValues): FormProblem[] {
  const lender = lenderFromForm(v);
  const bike = bikeFromForm(v);
  const p: FormProblem[] = [];
  if (!lender.name) p.push({ field: "lenderName", message: ct("Name des Verleihers fehlt.") });
  if (!lender.street || !lender.zipCity) p.push({ field: "lenderStreet", message: ct("Anschrift des Verleihers fehlt.") });
  if (!bike.make) p.push({ field: "make", message: ct("Bitte die Marke angeben.") });
  if (!bike.model) p.push({ field: "model", message: ct("Bitte das Modell angeben.") });
  return p;
}

/** The fields the contract needs (reference/leihvertrag-ausfuellen.md, Teil 2). Everything else stays a blank line to fill in by hand. */
export function pdfProblems(v: ContractFormValues): FormProblem[] {
  const bike = bikeFromForm(v);
  const p = partyAndBikeProblems(v);
  if (!bike.plate) p.push({ field: "plate", message: ct("Kennzeichen fehlt.") });
  if (!bike.vin) p.push({ field: "vin", message: ct("FIN fehlt.") });
  if (!bike.insurer) p.push({ field: "insurer", message: ct("Versicherer fehlt.") });
  if (!bike.policyNumber) p.push({ field: "policyNumber", message: ct("Versicherungsscheinnummer fehlt.") });
  const handLater = new Set(["licenseNumber", "returnPlace"]);
  return [...p, ...loanProblems(loanFromForm(v)).filter((x) => !handLater.has(x.field))];
}

/** Saving creates an active loan, so the loan rules apply in full. */
export function saveProblems(v: ContractFormValues): FormProblem[] {
  return [...partyAndBikeProblems(v), ...loanProblems(loanFromForm(v))];
}
