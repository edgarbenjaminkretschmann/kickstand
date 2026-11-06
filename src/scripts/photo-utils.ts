// Photo helpers that never talk to the server. The public generator (/leihvertrag) uses only these;
// photos.ts adds the upload on top for the logged-in pages.
import type { ContractPhoto } from "../lib/contract-pdf";
import { ct } from "../i18n/client";

const MAX_SIDE = 1600;

export async function shrink(file: File): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = no;
      im.src = URL.createObjectURL(file);
    });
  }
  const sc = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.round(source.width * sc);
  const h = Math.round(source.height * sc);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("toBlob failed");
  return blob;
}

/** An image Blob in the form buildContractPdf() wants. */
export async function blobToContractPhoto(blob: Blob, takenAt: ContractPhoto["takenAt"]): Promise<ContractPhoto> {
  const dataUrl = await new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });
  const bmp = await createImageBitmap(blob);
  const photo = { dataUrl, width: bmp.width, height: bmp.height, takenAt };
  bmp.close();
  return photo;
}

export function thumb(url: string, label: string, onRemove?: () => Promise<void>): HTMLElement {
  const d = document.createElement("div");
  d.className = "thumb";
  const im = document.createElement("img");
  im.src = url;
  im.alt = label;
  im.loading = "lazy";
  d.append(im);
  if (onRemove) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "×";
    b.setAttribute("aria-label", ct("{label} entfernen", { label }));
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await onRemove();
        d.remove();
      } catch {
        b.disabled = false;
      }
    });
    d.append(b);
  }
  return d;
}
