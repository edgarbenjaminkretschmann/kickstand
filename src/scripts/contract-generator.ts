// The public generator on /leihvertrag. Runs entirely in the browser: texts and switches go to localStorage,
// photos and signatures stay in memory, the PDF is built here. The only server code is contract-save.ts, loaded
// when a logged-in member taps "In meinem Konto speichern".
import { contractDataFromForm, capFromForm, invalidFields, pdfProblems, saveProblems, type ContractFormValues, type FormProblem } from "../lib/contract-form";
import type { ContractSignature } from "../lib/contract-pdf";
import { parseDate, parseTime } from "../lib/dates";
import { euroInWords, formatEuro } from "../lib/euro-words";
import { clientHref, ct } from "../i18n/client";
import { blobToContractPhoto, shrink, thumb } from "./photo-utils";
import { isIos, saveContractPdf } from "./pdf";
import { setupPad } from "./signature-pad";

const DRAFT_KEY = "kickstand.leihvertrag.draft.v1";

export interface LocalPhoto {
  blob: Blob;
  takenAt: number;
  uploaded: boolean;
}

const form = document.getElementById("generator") as HTMLFormElement | null;
if (form) start(form);

function start(form: HTMLFormElement) {
  const statusEl = document.getElementById("status")!;
  const status = (message: string, error = false) => {
    statusEl.textContent = message;
    statusEl.classList.toggle("err", error);
  };
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
  const value = (name: string) => field(name)?.value.trim() ?? "";

  // Enter in a text field must not do anything (and method="dialog" would swallow it anyway).
  form.addEventListener("submit", (e) => e.preventDefault());

  function readValues(): ContractFormValues {
    const v: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    for (const name of ["keys", "registration", "footpegs"]) v[name] = !!field(name)?.checked;
    return v as ContractFormValues;
  }

  // --- Draft: texts and switches only ---
  const NOT_IN_DRAFT = new Set(["sigLender", "sigBorrower"]);
  let draftTimer: number | undefined;
  // Off once the contract is saved: leaving the page must not write it back as a draft.
  let keepDraft = true;

  function controls() {
    return [...form.elements].filter(
      (el): el is HTMLInputElement | HTMLTextAreaElement =>
        (el instanceof HTMLInputElement && el.type !== "file" && !!el.name && !NOT_IN_DRAFT.has(el.name)) || (el instanceof HTMLTextAreaElement && !!el.name),
    );
  }

  function saveDraft() {
    clearTimeout(draftTimer);
    if (!keepDraft) return;
    const data: Record<string, string | boolean> = {};
    for (const el of controls()) {
      if (el instanceof HTMLInputElement && el.type === "checkbox") data[el.name] = el.checked;
      else if (el instanceof HTMLInputElement && el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else data[el.name] = el.value;
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      // Private mode or full storage: the form still works, only the draft is gone.
    }
  }

  function loadDraft() {
    let data: Record<string, string | boolean> | null = null;
    try {
      data = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    for (const el of controls()) {
      if (!(el.name in data)) continue;
      const saved = data[el.name];
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = saved === true;
      else if (el instanceof HTMLInputElement && el.type === "radio") el.checked = el.value === saved;
      else el.value = String(saved ?? "");
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to do.
    }
  }

  const scheduleDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 400);
  };
  form.addEventListener("input", scheduleDraft);
  form.addEventListener("change", scheduleDraft);
  // Phone locks, tab goes to the background, or the "Anmelden" link is followed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveDraft();
  });
  window.addEventListener("pagehide", saveDraft);

  // --- Errors right at the field ---
  function setFieldError(name: string, message: string | null) {
    const el = field(name);
    if (!el) return;
    const box = el.closest("label");
    let err = box?.querySelector<HTMLElement>(".error");
    if (message) {
      el.setAttribute("aria-invalid", "true");
      if (!err && box) {
        err = document.createElement("span");
        err.className = "error";
        box.append(err);
      }
      if (err) err.textContent = message;
    } else {
      el.removeAttribute("aria-invalid");
      err?.remove();
    }
  }

  function checkFormat(el: HTMLInputElement) {
    const v = el.value.trim();
    if (el.hasAttribute("data-date")) setFieldError(el.name, v && !parseDate(v) ? ct("Datum als TT.MM.JJJJ angeben.") : null);
    else if (el.hasAttribute("data-time")) setFieldError(el.name, v && !parseTime(v) ? ct("Uhrzeit als HH:MM angeben.") : null);
    else if (el.getAttribute("aria-invalid")) setFieldError(el.name, null);
  }

  form.addEventListener("focusout", (e) => {
    if (e.target instanceof HTMLInputElement) checkFormat(e.target);
  });
  // While typing, an existing error clears as soon as the value is right. A half-typed date does not nag.
  form.addEventListener("input", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.getAttribute("aria-invalid")) checkFormat(e.target);
  });

  function showProblems(problems: FormProblem[]) {
    for (const p of problems) setFieldError(p.field, ct(p.message));
    const first = problems[0] && field(problems[0].field);
    first?.closest("label")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function clearFieldErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    form.querySelectorAll(".error").forEach((el) => el.remove());
  }

  // --- Haftungsgrenze: amount and words follow the choice ---
  function refreshCap() {
    const cap = capFromForm(readValues());
    document.getElementById("cap-amount")!.textContent = cap === null ? ct("Bitte einen Betrag angeben.") : ct("höchstens {amount} je Schaden", { amount: formatEuro(cap, false) });
    document.getElementById("cap-words")!.textContent = cap === null ? "" : euroInWords(cap);
  }
  form.addEventListener("input", (e) => {
    if ((e.target as HTMLInputElement).name === "liabilityCapEur") refreshCap();
  });
  form.addEventListener("change", (e) => {
    if ((e.target as HTMLInputElement).name === "liabilityChoice") refreshCap();
  });

  // --- Rückgabeort buttons ---
  form.querySelectorAll<HTMLButtonElement>("[data-return-from]").forEach((b) =>
    b.addEventListener("click", () => {
      const who = b.dataset.returnFrom;
      const address = [value(`${who}Street`), value(`${who}ZipCity`)].filter(Boolean).join(", ");
      if (!address) {
        status(who === "lender" ? ct("Anschrift des Verleihers fehlt.") : ct("Anschrift des Entleihers fehlt."), true);
        return;
      }
      field("returnPlace")!.value = address;
      status("");
      saveDraft();
    }),
  );

  // --- Signatures: memory only ---
  const lenderCanvas = document.getElementById("pad-lender") as HTMLCanvasElement;
  const borrowerCanvas = document.getElementById("pad-borrower") as HTMLCanvasElement;
  const pads = {
    lender: setupPad(lenderCanvas, field("sigLender")!, () => {}),
    borrower: setupPad(borrowerCanvas, field("sigBorrower")!, () => {}),
  };
  form.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((b) =>
    b.addEventListener("click", () => pads[b.dataset.clear as "lender" | "borrower"].clear()),
  );

  function signature(name: string, canvas: HTMLCanvasElement): ContractSignature | null {
    const dataUrl = field(name)?.value;
    return dataUrl ? { dataUrl, ratio: canvas.width / canvas.height || 3 } : null;
  }

  // --- Photos: memory only ---
  const photos: Record<"handover" | "return", LocalPhoto[]> = { handover: [], return: [] };
  const boxes = {
    handover: document.getElementById("thumbs-handover")!,
    return: document.getElementById("thumbs-return")!,
  };

  function wirePhotos(kind: "handover" | "return", input: HTMLInputElement) {
    input.addEventListener("change", async () => {
      const files = [...(input.files ?? [])];
      input.value = "";
      let skipped = 0;
      for (const [i, file] of files.entries()) {
        if (!file.type.startsWith("image/")) {
          skipped++;
          continue;
        }
        status(ct("Foto {n} von {total} wird verkleinert …", { n: i + 1, total: files.length }));
        try {
          const photo: LocalPhoto = { blob: await shrink(file), takenAt: file.lastModified || Date.now(), uploaded: false };
          photos[kind].push(photo);
          const url = URL.createObjectURL(photo.blob);
          boxes[kind].append(
            thumb(url, ct("Foto {n}", { n: photos[kind].length }), async () => {
              photos[kind].splice(photos[kind].indexOf(photo), 1);
              URL.revokeObjectURL(url);
            }),
          );
        } catch {
          skipped++;
        }
      }
      status(skipped ? ct("{n} Datei(en) übersprungen. Nur Fotos sind möglich.", { n: skipped }) : "", skipped > 0);
    });
  }
  wirePhotos("handover", document.getElementById("file-handover") as HTMLInputElement);
  wirePhotos("return", document.getElementById("file-return") as HTMLInputElement);

  // --- PDF ---
  const pdfBtn = document.getElementById("make-pdf") as HTMLButtonElement;
  // The missing fields are asked for once, all together. A second tap builds the PDF with blanks to fill in by hand.
  let warnedAbout = "";

  pdfBtn.addEventListener("click", async () => {
    clearFieldErrors();
    const v = readValues();
    const invalid = invalidFields(v);
    if (invalid.length) {
      showProblems(invalid);
      status(ct("Bitte die markierten Felder korrigieren."), true);
      return;
    }
    const missing = pdfProblems(v);
    const key = missing.map((p) => p.field).join();
    if (missing.length && warnedAbout !== key) {
      warnedAbout = key;
      showProblems(missing);
      status(ct("Es fehlt noch: {list} Nochmal tippen erstellt das PDF trotzdem, die Lücken kannst du von Hand ausfüllen.", { list: missing.map((p) => ct(p.message)).join(" ") }), true);
      return;
    }
    pdfBtn.disabled = true;
    try {
      status(ct("PDF wird erstellt …"));
      const [handover, ret] = await Promise.all(
        (["handover", "return"] as const).map((k) => Promise.all(photos[k].map((p) => blobToContractPhoto(p.blob, p.takenAt)))),
      );
      const data = contractDataFromForm(v, {
        photos: { handover, return: ret },
        signatures: { lender: signature("sigLender", lenderCanvas), borrower: signature("sigBorrower", borrowerCanvas) },
      });
      const url = await saveContractPdf(data);
      warnedAbout = "";
      status(ct("PDF erstellt."));
      if (isIos()) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.textContent = ct("PDF öffnen");
        statusEl.append(" ", a);
      }
    } catch (e) {
      status(ct("PDF konnte nicht erstellt werden ({reason}).", { reason: (e as Error)?.message || ct("Fehler") }), true);
    } finally {
      pdfBtn.disabled = false;
    }
  });

  // --- Leeren: two taps (the first only arms it, see scripts/inputs.ts) ---
  const clearBtn = document.getElementById("clear-form") as HTMLButtonElement;
  clearBtn.addEventListener("click", () => {
    if (clearBtn.dataset.armed !== "1") return;
    clearTimeout(draftTimer);
    form.reset();
    clearDraft();
    clearFieldErrors();
    pads.lender.clear();
    pads.borrower.clear();
    for (const kind of ["handover", "return"] as const) {
      photos[kind].length = 0;
      boxes[kind].replaceChildren();
    }
    warnedAbout = "";
    savedLoan.id = null;
    savedLoan.active = false;
    refreshCap();
    status(ct("Formular geleert."));
  });

  // --- Logged in: save to the account. Only this path talks to the server. ---
  const savedLoan: { id: string | null; active: boolean } = { id: null, active: false };
  const saveBtn = document.getElementById("save-account") as HTMLButtonElement | null;
  saveBtn?.addEventListener("click", async () => {
    clearFieldErrors();
    const v = readValues();
    const local = [...invalidFields(v), ...saveProblems(v)];
    if (local.length) {
      showProblems(local);
      status(ct("Bitte ergänzen: {list}", { list: [...new Set(local.map((p) => ct(p.message)))].join(" ") }), true);
      return;
    }
    saveBtn.disabled = true;
    try {
      saveDraft();
      const { saveToAccount } = await import("./contract-save");
      const problems = await saveToAccount(form, savedLoan, photos, status);
      if (problems.length) {
        status(problems.map((p) => ct(p)).join(" "), true);
        return;
      }
      keepDraft = false;
      clearDraft();
      location.href = clientHref(`/app/loans/${savedLoan.id}?neu=1`);
    } catch (e) {
      status(ct("Nicht gespeichert ({reason}).", { reason: (e as Error)?.message || ct("offline?") }), true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // --- Start ---
  loadDraft();
  refreshCap();
  if (["returnDate", "returnTime", "returnKm", "returnFuel", "returnDamages"].some((n) => value(n))) {
    form.querySelector("details.return-card")?.setAttribute("open", "");
  }
}
