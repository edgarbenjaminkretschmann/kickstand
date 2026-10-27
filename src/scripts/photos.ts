// Client side photo handling: shrink before upload (phones produce 5-10 MB files),
// then upload one by one through the uploadPhoto action and show thumbnails.
import { actions } from "astro:actions";

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
    b.setAttribute("aria-label", `${label} entfernen`);
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

export async function deletePhoto(photoId: string) {
  const fd = new FormData();
  fd.set("photoId", photoId);
  const { error } = await actions.loans.deletePhoto(fd);
  if (error) throw error;
}

/**
 * Wires a file input: shrink, upload, render thumbnails. `getLoanId` may create the draft first.
 * Existing thumbs rendered by the server carry data-photo-id and get a remove handler here.
 */
export function wirePhotoInput(opts: {
  input: HTMLInputElement;
  box: HTMLElement;
  kind: "handover" | "return";
  getLoanId: () => Promise<string | null>;
  status: (text: string, error?: boolean) => void;
}) {
  const { input, box, kind, getLoanId, status } = opts;

  box.querySelectorAll<HTMLElement>("[data-photo-id]").forEach((el, i) => {
    const id = el.dataset.photoId!;
    el.replaceWith(thumb(el.querySelector("img")!.src, `Foto ${i + 1}`, () => deletePhoto(id)));
  });

  input.addEventListener("change", async () => {
    const files = [...(input.files ?? [])];
    input.value = ""; // never submit originals with the form once JS handled them
    if (!files.length) return;
    const loanId = await getLoanId();
    if (!loanId) {
      status("Bitte erst speichern, dann Fotos hinzufügen.", true);
      return;
    }
    let ok = 0;
    let bad = 0;
    for (const [i, file] of files.entries()) {
      if (!file.type.startsWith("image/")) {
        bad++;
        continue;
      }
      status(`Foto ${i + 1} von ${files.length} wird hochgeladen …`);
      const preview = URL.createObjectURL(file);
      const pending = thumb(preview, "Foto wird hochgeladen");
      pending.classList.add("pending");
      box.append(pending);
      try {
        const blob = await shrink(file);
        const fd = new FormData();
        fd.set("loanId", loanId);
        fd.set("kind", kind);
        fd.set("photo", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        fd.set("takenAt", String(file.lastModified || Date.now()));
        const { data, error } = await actions.loans.uploadPhoto(fd);
        if (error) throw error;
        const n = box.children.length;
        pending.replaceWith(thumb(data.url, `Foto ${n}`, () => deletePhoto(data.id)));
        ok++;
      } catch {
        pending.remove();
        bad++;
      } finally {
        URL.revokeObjectURL(preview);
      }
    }
    status(bad ? `${ok} Foto(s) gespeichert, ${bad} übersprungen. Nur Fotos sind möglich.` : `${ok} Foto(s) gespeichert.`, bad > 0);
  });
}
