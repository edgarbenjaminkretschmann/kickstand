// Builds the contract PDF in the browser from the loan's saved data.
import type { ContractData, ContractPhoto } from "../lib/contract-pdf";
import type { ContractPayload, PhotoRef } from "../lib/contract-data";
import { ct } from "../i18n/client";
import { blobToContractPhoto } from "./photo-utils";

async function toDataPhoto(ref: PhotoRef): Promise<ContractPhoto> {
  const res = await fetch(ref.url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`photo ${ref.id}: ${res.status}`);
  return blobToContractPhoto(await res.blob(), ref.takenAt);
}

let lastUrl: string | null = null;

/** iPhones and iPads, also iPadOS pretending to be a Mac. Their download handling varies by browser. */
export function isIos(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * The one way out for every contract PDF, logged in or not: buildContractPdf(), a Blob, an <a download>.
 * Returns the Blob URL, so a page can also offer it as a link (iOS browsers that ignore the download).
 */
export async function saveContractPdf(data: ContractData): Promise<string> {
  // jsPDF is large; only load it when someone actually wants a PDF.
  const { buildContractPdf, contractFileName } = await import("../lib/contract-pdf");
  const blob = buildContractPdf(data).output("blob");
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = lastUrl;
  a.download = contractFileName(data);
  document.body.append(a);
  a.click();
  a.remove();
  return lastUrl;
}

/** Fetches contract data, builds the PDF with jsPDF and starts the download. The PDF itself is always German. */
export async function downloadContract(loanId: string, onProgress?: (text: string) => void): Promise<void> {
  onProgress?.(ct("Daten werden geladen …"));
  const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/contract.json`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`contract: ${res.status}`);
  const payload = (await res.json()) as ContractPayload;

  const total = payload.photos.handover.length + payload.photos.return.length;
  if (total) onProgress?.(ct("{n} Foto(s) werden eingebunden …", { n: total }));
  const [handover, ret] = await Promise.all([
    Promise.all(payload.photos.handover.map(toDataPhoto)),
    Promise.all(payload.photos.return.map(toDataPhoto)),
  ]);
  const data: ContractData = { ...payload, photos: { handover, return: ret } };

  onProgress?.(ct("PDF wird erstellt …"));
  await saveContractPdf(data);
}
