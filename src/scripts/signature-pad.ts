// Finger signature on a canvas. White background, pointer events, `touch-action: none` in CSS.
// The PNG data URL is mirrored into a hidden input so it is saved with the form.

export interface Pad {
  clear(): void;
  readonly dirty: boolean;
}

export function setupPad(canvas: HTMLCanvasElement, input: HTMLInputElement, onChange: () => void): Pad {
  const ctx = canvas.getContext("2d")!;
  let drawing = false;
  let dirty = !!input.value;
  let last = { x: 0, y: 0 };

  function paintBackground(w: number, h: number) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawImage(src: string) {
    const r = canvas.getBoundingClientRect();
    const im = new Image();
    im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height);
    im.src = src;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    const keep = dirty ? input.value || canvas.toDataURL("image/png") : null;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    paintBackground(canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    ctx.fillStyle = "#111111";
    if (keep) drawImage(keep);
  }

  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function commit() {
    input.value = dirty ? canvas.toDataURL("image/png") : "";
    onChange();
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drawing = true;
    last = pos(e);
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
    dirty = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    commit();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  let resizeTimer: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(size, 150);
  });
  size();

  return {
    clear() {
      dirty = false;
      paintBackground(canvas.width, canvas.height);
      commit();
    },
    get dirty() {
      return dirty;
    },
  };
}
