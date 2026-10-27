import { describe, expect, it } from "vitest";
import { buildContractPdf, contractFileName, nameFirstLast, nameLastFirst, type ContractData } from "../src/lib/contract-pdf";
import { demoBike, demoLoan, demoProtocols, demoUsers } from "../src/db/seed-data";

// 1x1 white PNG and JPEG, enough to exercise the image paths.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC";
const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

function seedContract(): ContractData {
  const lender = demoUsers[0].profile;
  const [h, r] = demoProtocols;
  return {
    loan: demoLoan,
    bike: demoBike,
    lender: { name: lender.name, street: lender.street, zipCity: lender.zipCity },
    protocols: { handover: h, return: r },
    photos: { handover: [], return: [] },
    signatures: { lender: { dataUrl: PNG, ratio: 3 }, borrower: null },
  };
}

function pageCount(bytes: ArrayBuffer): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type \/Page\b/g) ?? []).length;
}

describe("buildContractPdf", () => {
  it("builds at least 3 pages for the seed loan", () => {
    const doc = buildContractPdf(seedContract());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const bytes = doc.output("arraybuffer");
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pageCount(bytes)).toBe(doc.getNumberOfPages());
  });

  it("adds one photo page per 6 photos", () => {
    const base = buildContractPdf(seedContract()).getNumberOfPages();
    const data = seedContract();
    const photo = { dataUrl: JPEG, width: 1, height: 1, takenAt: "2026-05-01T10:00:00" };
    data.photos.handover = Array.from({ length: 7 }, () => photo);
    data.photos.return = [photo];
    expect(buildContractPdf(data).getNumberOfPages()).toBe(base + 3);
  });

  it("writes the liability cap in numbers and words", () => {
    const doc = buildContractPdf(seedContract());
    const raw = doc.output();
    expect(raw).toContain("1.000,00");
    expect(raw).toContain("eintausend Euro");
    expect(raw).not.toMatch(/vorzeitig|früher zurückgeben/);
  });

  it("names the file after bike, cap and borrower", () => {
    expect(contractFileName(seedContract())).toBe("Leihvertrag_VFR-750-F_1000EUR_Beispiel_2026-05-01.pdf");
  });
});

describe("name helpers", () => {
  it("switches between 'First Last' and 'Last, First'", () => {
    expect(nameLastFirst("Erika Mustermann")).toBe("Mustermann, Erika");
    expect(nameLastFirst("Beispiel, Max")).toBe("Beispiel, Max");
    expect(nameFirstLast("Beispiel, Max")).toBe("Max Beispiel");
  });
});
