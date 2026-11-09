import { beforeAll, describe, expect, it } from "vitest";
import {
  bikeFromForm,
  capFromForm,
  contractDataFromForm,
  FOOTPEG_CONDITION,
  handoverFromForm,
  invalidFields,
  loanFromForm,
  pdfProblems,
  returnFromForm,
  saveProblems,
  type ContractFormValues,
} from "../src/lib/contract-form";
import { matchBike } from "../src/lib/data/bikes";
import { createLoan, loadLoanParts } from "../src/lib/data/loans";
import { ERIKA, ERIKA_BIKE, setupDb } from "./helpers/db";

const complete: ContractFormValues = {
  lenderName: " Hoffmann, Jana ",
  lenderStreet: "Kastanienallee 12",
  lenderZipCity: "10435 Berlin",
  borrowerName: "Brandt, Lukas",
  borrowerStreet: "Lindenstraße 7",
  borrowerZipCity: "50674 Köln",
  borrowerBirthdate: "14.03.1990",
  licenseNumber: "K0123456789",
  make: "Yamaha",
  model: "XT 660 R",
  plate: "k-lb 660",
  vin: "jyadm 010000123456",
  firstRegistration: "14.04.2008",
  powerKw: "35",
  displacementCcm: "660",
  insurer: "Musterversicherung AG",
  policyNumber: "MV-2026-004711",
  liabilityChoice: "1500",
  startDate: "01.11.2026",
  startTime: "10:00",
  endMode: "open",
  latestEndDate: "31.12.2026",
  returnPlace: "Kastanienallee 12, 10435 Berlin",
  keys: true,
  keyCount: "2",
  registration: false,
  otherItems: "Topcase",
  odometerKm: "48.230",
  fuelLevel: "voll",
  damages: "Kratzer am Tank",
  placeDate: "Berlin, 01.11.2026",
};

describe("form -> contract data", () => {
  it("maps text, dates and numbers", () => {
    const d = contractDataFromForm(complete);
    expect(d.lender).toEqual({ name: "Hoffmann, Jana", street: "Kastanienallee 12", zipCity: "10435 Berlin" });
    expect(d.loan.borrowerBirthdate).toBe("1990-03-14");
    expect(d.loan.liabilityCapEur).toBe(1500);
    expect(d.loan.handedOverItems).toEqual({ keys: true, keyCount: 2, registration: false, other: "Topcase" });
    expect(d.bike.plate).toBe("K-LB 660");
    expect(d.bike.vin).toBe("JYADM010000123456");
    expect(d.bike.firstRegistration).toBe("2008-04-14");
    expect(d.bike.powerKw).toBe(35);
    expect(d.protocols.handover).toEqual({ datetime: "2026-11-01T10:00", odometerKm: 48230, fuelLevel: "voll", damages: "Kratzer am Tank" });
    expect(d.protocols.return).toBeNull();
    expect(d.photos).toEqual({ handover: [], return: [] });
    expect(d.signatures).toEqual({ lender: null, borrower: null });
  });

  it("turns the Feld 22 switch into the condition", () => {
    expect(bikeFromForm({ footpegs: true }).conditions).toBe(FOOTPEG_CONDITION);
    expect(bikeFromForm({ footpegs: false }).conditions).toBe("");
  });

  it("reads the cap from the buttons or the free amount", () => {
    expect(capFromForm({ liabilityChoice: "500", liabilityCapEur: "9999" })).toBe(500);
    expect(capFromForm({ liabilityChoice: "other", liabilityCapEur: "2.500" })).toBe(2500);
    expect(capFromForm({ liabilityChoice: "other", liabilityCapEur: "750,40" })).toBe(750);
    expect(capFromForm({ liabilityCapEur: "750" })).toBe(750); // the wizard has no buttons
    expect(capFromForm({ liabilityChoice: "other", liabilityCapEur: "" })).toBeNull();
    expect(capFromForm({ liabilityChoice: "other", liabilityCapEur: "100001" })).toBeNull();
  });

  it("keeps the fallback cap in the wizard, whose amount may be empty", () => {
    expect(loanFromForm({ liabilityCapEur: "" }, 800).liabilityCapEur).toBe(800);
  });

  it("does not invent a time for the protocol", () => {
    expect(handoverFromForm({ startDate: "01.11.2026" }).datetime).toBe("2026-11-01");
    expect(handoverFromForm({}).datetime).toBeNull();
  });

  it("has a return protocol only once something is filled in", () => {
    expect(returnFromForm({ returnDate: " ", returnFuel: "" })).toBeNull();
    expect(returnFromForm({ returnKm: "50000" })?.odometerKm).toBe(50000);
  });
});

describe("form checks", () => {
  it("accepts complete data", () => {
    expect(invalidFields(complete)).toEqual([]);
    expect(pdfProblems(complete)).toEqual([]);
    expect(saveProblems(complete)).toEqual([]);
  });

  it("blocks values that would silently vanish from the contract", () => {
    const fields = invalidFields({ ...complete, startDate: "31.02.2026", startTime: "25:00", odometerKm: "viel", liabilityChoice: "other", liabilityCapEur: "x" }).map((p) => p.field);
    expect(fields).toEqual(["startDate", "startTime", "odometerKm", "liabilityCapEur"]);
  });

  it("the PDF may leave licence and return place for the pen, saving may not", () => {
    const v = { ...complete, licenseNumber: "", returnPlace: "" };
    expect(pdfProblems(v)).toEqual([]);
    expect(saveProblems(v).map((p) => p.field)).toEqual(["licenseNumber", "returnPlace"]);
  });

  it("names what the contract needs", () => {
    const fields = pdfProblems({ endMode: "fixed" }).map((p) => p.field);
    expect(fields).toEqual(["lenderName", "lenderStreet", "make", "model", "plate", "vin", "insurer", "policyNumber", "borrowerName", "borrowerStreet", "startDate", "endDate"]);
  });

  it("notices an end before the start", () => {
    expect(pdfProblems({ ...complete, latestEndDate: "01.10.2026" }).map((p) => p.field)).toEqual(["latestEndDate"]);
  });
});

describe("matchBike", () => {
  const a = { id: "a", vin: "VIN1", plate: "M-A 1" };
  const b = { id: "b", vin: "", plate: "M-B 2" };

  it("finds by FIN, then by plate", () => {
    expect(matchBike([a, b], "vin1", "")?.id).toBe("a");
    expect(matchBike([a, b], "", "m-b 2")?.id).toBe("b");
    expect(matchBike([a, b], "VIN9", "M-B 2")?.id).toBe("b"); // b has no FIN yet
  });

  it("a plate does not join two different FINs, and empty never matches", () => {
    expect(matchBike([a, b], "VIN9", "M-A 1")).toBeNull();
    expect(matchBike([a, b], "", "")).toBeNull();
  });
});

describe("lender on a saved contract", () => {
  beforeAll(setupDb);

  it("uses the lender written on the contract, else the member", async () => {
    await createLoan("loan_profile", ERIKA_BIKE, ERIKA, {});
    expect((await loadLoanParts("loan_profile"))!.lender.name).toBe("Erika Mustermann");

    await createLoan("loan_snapshot", ERIKA_BIKE, ERIKA, { lenderName: "Hoffmann, Jana", lenderStreet: "Kastanienallee 12", lenderZipCity: "10435 Berlin" });
    expect((await loadLoanParts("loan_snapshot"))!.lender).toMatchObject({ name: "Hoffmann, Jana", street: "Kastanienallee 12", zipCity: "10435 Berlin" });
  });
});
