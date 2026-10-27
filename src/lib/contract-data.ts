// Builds what the contract PDF needs for one loan. Server only; the data comes from the data layer.
import type { ContractData, ContractProtocol, ContractSignature } from "./contract-pdf";
import { loadLoanParts, toItems } from "./data/loans";
import { photoUrl } from "./urls";

export { DEFAULT_ITEMS, loadLoanParts, toItems } from "./data/loans";

/** Photo reference before the browser turns it into a data URL. */
export interface PhotoRef {
  id: string;
  url: string;
  takenAt: string;
}

export type ContractPayload = Omit<ContractData, "photos"> & {
  photos: { handover: PhotoRef[]; return: PhotoRef[] };
};

/** Reads width/height from a PNG data URL's IHDR chunk. */
export function pngRatio(dataUrl: string): number {
  try {
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1, dataUrl.indexOf(",") + 1 + 44);
    const bytes = Buffer.from(b64, "base64");
    const w = bytes.readUInt32BE(16);
    const h = bytes.readUInt32BE(20);
    return w > 0 && h > 0 ? w / h : 3;
  } catch {
    return 3;
  }
}

export async function loadContractPayload(loanId: string): Promise<ContractPayload | null> {
  const parts = await loadLoanParts(loanId);
  if (!parts) return null;
  const { loan, bike, lender, handover, ret, handoverPhotos, returnPhotos, signatures } = parts;
  const proto = (p: typeof handover): ContractProtocol | null =>
    p ? { datetime: p.datetime, odometerKm: p.odometerKm, fuelLevel: p.fuelLevel, damages: p.damages } : null;
  const sig = (s: typeof signatures.lender): ContractSignature | null =>
    s ? { dataUrl: s.pngDataUrl, ratio: pngRatio(s.pngDataUrl) } : null;
  const ref = (p: (typeof handoverPhotos)[number]): PhotoRef => ({ id: p.id, url: photoUrl(p.id), takenAt: p.takenAt.toISOString() });
  return {
    loan: { ...loan, handedOverItems: toItems(loan.handedOverItems) },
    bike,
    lender: { name: lender.name, street: lender.street, zipCity: lender.zipCity },
    protocols: { handover: proto(handover), return: proto(ret) },
    photos: { handover: handoverPhotos.map(ref), return: returnPhotos.map(ref) },
    signatures: { lender: sig(signatures.lender), borrower: sig(signatures.borrower) },
  };
}
