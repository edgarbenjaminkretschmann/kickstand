// Adds separators while typing into date (TT.MM.JJJJ) and time (HH:MM) text fields, since many phone
// number pads have no "." or ":" key. Only reacts to plain typing, so deleting stays predictable.

function formatDigits(digits: string, groups: number[], sep: string): string {
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  return parts.join(sep);
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if ((e as InputEvent).inputType !== "insertText") return;
  if (el.hasAttribute("data-date")) {
    const v = el.value;
    // Only auto-format pure digit input; leave anything typed with separators alone.
    if (/^\d+$/.test(v) && v.length >= 3) el.value = formatDigits(v.slice(0, 8), [2, 2, 4], ".");
    else if (/^\d{1,2}\.\d{3,}$/.test(v)) el.value = v.replace(/^(\d{1,2})\.(\d{2})(\d+)$/, "$1.$2.$3");
  } else if (el.hasAttribute("data-time")) {
    const v = el.value;
    if (/^\d{4}$/.test(v)) el.value = `${v.slice(0, 2)}:${v.slice(2)}`;
  }
});

// "930" only becomes "09:30" when leaving the field, since it could still turn into "0930".
document.addEventListener("focusout", (e) => {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.hasAttribute("data-time") && /^\d{3}$/.test(el.value)) {
    el.value = `0${el.value[0]}:${el.value.slice(1)}`;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
});

// Two-tap confirm for destructive buttons, instead of a blocking confirm() dialog.
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-confirm]");
  if (!btn) return;
  if (btn.dataset.armed === "1") return;
  e.preventDefault();
  const original = btn.textContent;
  btn.dataset.armed = "1";
  btn.classList.add("armed");
  btn.textContent = btn.dataset.confirm || "Wirklich?";
  setTimeout(() => {
    delete btn.dataset.armed;
    btn.classList.remove("armed");
    btn.textContent = original;
  }, 3000);
});
