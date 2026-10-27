// Listing photos: shrink in the browser right after choosing, then put the small JPEGs back into the
// file input so the normal form post uploads them. Without JS the originals are posted and shrunk on the server.
import { shrink } from "./photos";

export function wireListingPhotos(input: HTMLInputElement, box: HTMLElement, statusEl: HTMLElement) {
  const room = Number(input.dataset.room) || 8;
  const defaultText = statusEl.textContent ?? "";
  const form = input.form;
  let busy: Promise<void> | null = null;

  input.addEventListener("change", () => {
    busy = (async () => {
      const files = [...(input.files ?? [])].filter((f) => f.type.startsWith("image/"));
      const picked = files.slice(0, room);
      box.replaceChildren();
      if (!picked.length) {
        statusEl.textContent = defaultText;
        return;
      }
      statusEl.textContent = `${picked.length} Foto(s) werden verkleinert …`;
      const dt = new DataTransfer();
      for (const [i, file] of picked.entries()) {
        let out: File = file;
        try {
          const blob = await shrink(file);
          out = new File([blob], `foto-${i + 1}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        } catch {
          // Keep the original; the server shrinks it too.
        }
        dt.items.add(out);
        const d = document.createElement("div");
        d.className = "thumb";
        const im = document.createElement("img");
        im.src = URL.createObjectURL(out);
        im.alt = i === 0 ? "Titelbild" : `Foto ${i + 1}`;
        d.append(im);
        box.append(d);
      }
      input.files = dt.files;
      const skipped = files.length - picked.length;
      statusEl.textContent = `${picked.length} Foto(s) bereit${skipped > 0 ? `, ${skipped} übersprungen (höchstens ${room})` : ""}. Sie werden beim Speichern hochgeladen.`;
    })();
  });

  // Do not submit while photos are still being shrunk.
  form?.addEventListener("submit", async (e) => {
    if (!busy) return;
    e.preventDefault();
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    await busy;
    busy = null;
    form.requestSubmit(submitter);
  });
}
