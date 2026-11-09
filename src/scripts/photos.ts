// Client side photo handling: shrink before upload (phones produce 5-10 MB files),
// then upload one by one through the uploadPhoto action and show thumbnails.
import { actions } from "astro:actions";
import { ct } from "../i18n/client";
import { shrink, thumb } from "./photo-utils";

export { shrink } from "./photo-utils";

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
    el.replaceWith(thumb(el.querySelector("img")!.src, ct("Foto {n}", { n: i + 1 }), () => deletePhoto(id)));
  });

  input.addEventListener("change", async () => {
    const files = [...(input.files ?? [])];
    input.value = ""; // never submit originals with the form once JS handled them
    if (!files.length) return;
    const loanId = await getLoanId();
    if (!loanId) {
      status(ct("Bitte erst speichern, dann Fotos hinzufügen."), true);
      return;
    }
    let ok = 0;
    let bad = 0;
    for (const [i, file] of files.entries()) {
      if (!file.type.startsWith("image/")) {
        bad++;
        continue;
      }
      status(ct("Foto {n} von {total} wird hochgeladen …", { n: i + 1, total: files.length }));
      const preview = URL.createObjectURL(file);
      const pending = thumb(preview, ct("Foto wird hochgeladen"));
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
        pending.replaceWith(thumb(data.url, ct("Foto {n}", { n }), () => deletePhoto(data.id)));
        ok++;
      } catch {
        pending.remove();
        bad++;
      } finally {
        URL.revokeObjectURL(preview);
      }
    }
    status(
      bad ? ct("{ok} Foto(s) gespeichert, {bad} übersprungen. Nur Fotos sind möglich.", { ok, bad }) : ct("{ok} Foto(s) gespeichert.", { ok }),
      bad > 0,
    );
  });
}
