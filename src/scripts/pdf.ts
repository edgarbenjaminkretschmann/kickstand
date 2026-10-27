// Builds the contract PDF in the browser from the loan's saved data.
import type { ContractData, ContractPhoto } from "../lib/contract-pdf";
import type { ContractPayload, PhotoRef } from "../lib/contract-data";

async function toDataPhoto(ref: PhotoRef): Promise<ContractPhoto> {
  const res = await fetch(ref.url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`photo ${ref.id}: ${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });
  const bmp = await createImageBitmap(blob);
  const photo = { dataUrl, width: bmp.width, height: bmp.height, takenAt: ref.takenAt };
  bmp.close();
  return photo;
}

/** Fetches contract data, builds the PDF with jsPDF and starts the download. */
export async function downloadContract(loanId: string, onProgress?: (text: string) => void): Promise<void> {
  onProgress?.("Daten werden geladen …");
  const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/contract.json`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`contract: ${res.status}`);
  const payload = (await res.json()) as ContractPayload;

  const total = payload.photos.handover.length + payload.photos.return.length;
  if (total) onProgress?.(`${total} Foto(s) werden eingebunden …`);
  const [handover, ret] = await Promise.all([
    Promise.all(payload.photos.handover.map(toDataPhoto)),
    Promise.all(payload.photos.return.map(toDataPhoto)),
  ]);
  const data: ContractData = { ...payload, photos: { handover, return: ret } };

  onProgress?.("PDF wird erstellt …");
  // jsPDF is large; only load it when someone actually wants a PDF.
  const { buildContractPdf, contractFileName } = await import("../lib/contract-pdf");
  const doc = buildContractPdf(data);
  doc.save(contractFileName(data));
}
