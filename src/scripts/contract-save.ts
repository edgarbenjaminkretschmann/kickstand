// "In meinem Konto speichern" on /leihvertrag. Loaded only when a logged-in member taps the button; this is the one
// part of the generator that sends anything to the server. A second tap after a failure continues where it stopped.
import { actions } from "astro:actions";
import { ct } from "../i18n/client";
import type { LocalPhoto } from "./contract-generator";

async function upload(loanId: string, kind: "handover" | "return", list: LocalPhoto[], status: (message: string) => void) {
  const open = list.filter((p) => !p.uploaded);
  for (const [i, photo] of open.entries()) {
    status(ct("Foto {n} von {total} wird hochgeladen …", { n: i + 1, total: open.length }));
    const fd = new FormData();
    fd.set("loanId", loanId);
    fd.set("kind", kind);
    fd.set("photo", new File([photo.blob], "foto.jpg", { type: "image/jpeg" }));
    fd.set("takenAt", String(photo.takenAt));
    const { error } = await actions.loans.uploadPhoto(fd);
    if (error) throw error;
    photo.uploaded = true;
  }
}

/** Returns German problem keys, or an empty list when the loan is active and all photos are up. Fills in `saved`. */
export async function saveToAccount(
  form: HTMLFormElement,
  saved: { id: string | null; active: boolean },
  photos: Record<"handover" | "return", LocalPhoto[]>,
  status: (message: string) => void,
): Promise<string[]> {
  // Registered here so the browser dictionary has this server message.
  void ct("Dieses Motorrad ist gerade verliehen. Erst die Rückgabe abschließen.");

  if (!saved.active) {
    status(ct("Speichert …"));
    const fd = new FormData(form);
    if (saved.id) fd.set("loanId", saved.id);
    const { data, error } = await actions.loans.saveGenerated(fd);
    if (error) throw error;
    if (!data.loanId) return data.problems;
    saved.id = data.loanId;

    await upload(saved.id, "handover", photos.handover, status);

    const fdActive = new FormData();
    fdActive.set("loanId", saved.id);
    const result = await actions.loans.activate(fdActive);
    if (result.error) throw result.error;
    if (result.data.problems.length) return result.data.problems;
    saved.active = true;
  }
  // The server only takes return photos on an active loan.
  await upload(saved.id!, "return", photos.return, status);
  return [];
}
