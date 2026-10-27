// Builds the German loan contract ("Leihvertrag") as a jsPDF document.
// Pure: everything comes in through `data`, so the same code runs in the browser and in tests.
// Wording, section order and layout follow reference/leihvertrag-reference.html.

import { jsPDF } from "jspdf";
import { formatDate, formatDateTime, formatTimestamp } from "./dates";
import { euroInWords, formatEuro, groupThousands } from "./euro-words";

export interface HandedOverItems {
  keys: boolean;
  keyCount: number;
  registration: boolean;
  other: string;
}

export interface ContractLoan {
  borrowerName: string;
  borrowerStreet: string;
  borrowerZipCity: string;
  borrowerBirthdate?: string | null;
  borrowerPhone: string;
  licenseNumber: string;
  licenseClassASince: string;
  startDate?: string | null;
  startTime?: string | null;
  endMode: "open" | "fixed" | string;
  endDate?: string | null;
  endTime?: string | null;
  latestEndDate?: string | null;
  returnPlace: string;
  liabilityCapEur: number;
  handedOverItems: HandedOverItems;
  placeDate: string;
}

export interface ContractBike {
  make: string;
  model: string;
  typeCode: string;
  plate: string;
  vin: string;
  firstRegistration?: string | null;
  powerKw?: number | null;
  displacementCcm?: number | null;
  fuel: string;
  conditions: string;
  insurer: string;
  policyNumber: string;
}

export interface ContractPerson {
  name: string;
  street: string;
  zipCity: string;
}

export interface ContractProtocol {
  datetime?: string | null; // "YYYY-MM-DDTHH:MM"
  odometerKm?: number | null;
  fuelLevel: string;
  damages: string;
}

export interface ContractPhoto {
  dataUrl: string;
  width: number;
  height: number;
  takenAt: string | number | Date;
}

export interface ContractSignature {
  dataUrl: string; // PNG
  ratio: number; // width / height
}

export interface ContractData {
  loan: ContractLoan;
  bike: ContractBike;
  lender: ContractPerson;
  protocols: { handover?: ContractProtocol | null; return?: ContractProtocol | null };
  photos: { handover: ContractPhoto[]; return: ContractPhoto[] };
  signatures: { lender?: ContractSignature | null; borrower?: ContractSignature | null };
}

const L = 20; // left margin (mm)
const W = 170; // text width
const BOT = 280; // last usable y before the footer
const BLANK = "________________";

/** "Edgar Kretschmann" -> "Kretschmann, Edgar". Leaves names that already have a comma alone. */
export function nameLastFirst(name: string): string {
  const n = name.trim();
  if (!n || n.includes(",")) return n;
  const parts = n.split(/\s+/);
  if (parts.length < 2) return n;
  const last = parts.pop()!;
  return `${last}, ${parts.join(" ")}`;
}

/** "Kretschmann, Edgar" -> "Edgar Kretschmann", for the signature line. */
export function nameFirstLast(name: string): string {
  const n = name.trim();
  const i = n.indexOf(",");
  return i < 0 ? n : `${n.slice(i + 1).trim()} ${n.slice(0, i).trim()}`.trim();
}

export function bikeTitle(bike: Pick<ContractBike, "make" | "model">): string {
  return [bike.make, bike.model].filter(Boolean).join(" ");
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

export function buildContractPdf(data: ContractData): jsPDF {
  const { loan, bike, lender, protocols, photos, signatures } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  const title = bikeTitle(bike);
  const cap = loan.liabilityCapEur;

  const ensure = (h: number) => {
    if (y + h > BOT) {
      doc.addPage();
      y = 18;
    }
  };
  const font = (bold: boolean | undefined, size: number) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };
  function para(t: string, o: { bold?: boolean; size?: number; after?: number } = {}) {
    const size = o.size ?? 9.5;
    font(o.bold, size);
    const lh = size * 0.42 + 0.4;
    const lines: string[] = doc.splitTextToSize(t, W);
    lines.forEach((l) => {
      ensure(lh);
      doc.text(l, L, y);
      y += lh;
    });
    y += o.after ?? 1.6;
  }
  function head(t: string) {
    ensure(14);
    y += 2.5;
    font(true, 11);
    doc.text(t, L, y);
    y += 5.2;
  }
  type Img = ContractSignature | null | undefined;
  function table(
    rows: (string | number | null | undefined)[][],
    ws: number[],
    o: { headRow?: boolean; minH?: number[]; images?: (Img[] | null)[] } = {},
  ) {
    const lh = 4.1;
    rows.forEach((r, i) => {
      font(false, 9);
      const cells: string[][] = r.map((c, j) => doc.splitTextToSize(String(c ?? ""), ws[j] - 4));
      const minH = o.minH?.[i] ?? 7.5;
      const h = Math.max(minH, Math.max(...cells.map((c) => c.length)) * lh + 3.4);
      ensure(h);
      let x = L;
      r.forEach((_, j) => {
        const isHead = j === 0 || (o.headRow && i === 0);
        if (isHead) {
          doc.setFillColor(242, 242, 242);
          doc.rect(x, y, ws[j], h, "F");
        }
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.rect(x, y, ws[j], h);
        font(o.headRow && i === 0, 9);
        doc.text(cells[j], x + 2, y + 4.6);
        const im = o.images?.[i]?.[j];
        if (im) {
          const ih = h - 2.5;
          const iw = Math.min(ws[j] - 4, ih * im.ratio);
          doc.addImage(im.dataUrl, "PNG", x + 2, y + 1.2, iw, ih);
        }
        x += ws[j];
      });
      y += h;
    });
    y += 6.5;
  }

  // --- Title and parties ---
  font(true, 17);
  doc.text("Leihvertrag über ein Motorrad", 105, y + 2, { align: "center" });
  y += 8;
  font(false, 9.5);
  doc.setTextColor(90);
  doc.text("unentgeltliche Leihe gemäß §§ 598 ff. BGB", 105, y, { align: "center" });
  doc.setTextColor(0);
  y += 8;

  para("Zwischen", { after: 2.5 });
  para("Verleiher", { bold: true, size: 10.5, after: 1.2 });
  table(
    [
      ["Name, Vorname", nameLastFirst(lender.name)],
      ["Anschrift", [lender.street, lender.zipCity].filter(Boolean).join(", ")],
    ],
    [50, 120],
  );
  para("und", { after: 2.5 });
  para("Entleiher", { bold: true, size: 10.5, after: 1.2 });
  table(
    [
      ["Name, Vorname", loan.borrowerName],
      ["Anschrift", [loan.borrowerStreet, loan.borrowerZipCity].filter(Boolean).join(", ")],
      ["Geburtsdatum", formatDate(loan.borrowerBirthdate)],
      ["Telefon", loan.borrowerPhone],
      ["Führerschein-Nr.", loan.licenseNumber],
      ["Klasse A seit", loan.licenseClassASince],
    ],
    [50, 120],
  );
  para("wird folgender Leihvertrag geschlossen:");

  // --- § 1 ---
  head("§ 1 Leihgegenstand");
  const items = loan.handedOverItems;
  const mit: string[] = [];
  if (items.keys) mit.push(`Fahrzeugschlüssel (Anzahl: ${items.keyCount || 1})`);
  if (items.registration) mit.push("Zulassungsbescheinigung Teil I");
  if (items.other?.trim()) mit.push(items.other.trim());
  const vehicle = `${title}${bike.typeCode ? ` (Typ ${bike.typeCode})` : ""}, Kraftrad`;
  const power = [bike.powerKw ? `${bike.powerKw} kW` : "", bike.displacementCcm ? `${bike.displacementCcm} ccm` : ""]
    .filter(Boolean)
    .join(" / ");
  table(
    [
      ["Fahrzeug", vehicle],
      ["Amtl. Kennzeichen", bike.plate],
      ["Fahrzeug-Ident.-Nr.", bike.vin],
      ["Erstzulassung", formatDate(bike.firstRegistration)],
      ["Leistung / Hubraum", [power, bike.fuel].filter(Boolean).join(", ")],
      ["Mitgegeben", mit.join("; ")],
    ],
    [50, 120],
  );

  // --- § 2 ---
  head("§ 2 Leihdauer und Rückgabe");
  const open = loan.endMode !== "fixed";
  const latest = formatDate(loan.latestEndDate) || BLANK;
  table(
    [
      ["Beginn der Leihe", formatDateTime(loan.startDate, loan.startTime)],
      ["Ende / Rückgabe", open ? `offen (unbefristet), spätestens am ${latest}` : formatDateTime(loan.endDate, loan.endTime)],
      ["Rückgabeort", loan.returnPlace],
    ],
    [50, 120],
  );
  if (open) {
    para(
      `Die Leihe ist unbefristet. Der Verleiher kann das Motorrad jederzeit zurückfordern (§ 604 Abs. 3 BGB); der Entleiher gibt es dann innerhalb von 3 Tagen nach Aufforderung zurück. Die Leihe endet in jedem Fall spätestens am ${latest}.`,
    );
  }
  para(
    "Der Entleiher gibt das Motorrad pünktlich, sauber und mit gleichem Tankstand am vereinbarten Rückgabeort zurück. Eine Verlängerung bedarf der Zustimmung des Verleihers.",
  );

  // --- § 3 ---
  head("§ 3 Unentgeltlichkeit und Kosten");
  para(
    "Die Überlassung erfolgt unentgeltlich. Kraftstoff während der Leihzeit trägt der Entleiher. Bußgelder, Verwarnungsgelder, Maut-, Park- und Abschleppkosten, die während der Leihzeit entstehen, trägt der Entleiher in voller Höhe; dies fällt nicht unter die Haftungsbegrenzung nach § 6.",
  );

  // --- § 4 ---
  head("§ 4 Nutzung");
  const conditions = bike.conditions?.trim();
  para(
    "(1) Das Motorrad darf ausschließlich vom Entleiher gefahren werden. Er versichert, eine gültige Fahrerlaubnis der Klasse A zu besitzen, und legt diese bei Übergabe vor. Eine Weitergabe an Dritte ist nicht gestattet.",
    { after: 0.6 },
  );
  para(
    "(2) Fahrten unter Einfluss von Alkohol, Drogen oder fahrtüchtigkeitsbeeinträchtigenden Medikamenten sind untersagt, ebenso Rennen, Fahrten auf Rennstrecken, Fahrsicherheitstrainings und Fahrten abseits befestigter Straßen.",
    { after: 0.6 },
  );
  para("(3) Fahrten ins Ausland nur nach vorheriger Zustimmung des Verleihers.", { after: 0.6 });
  para(
    "(4) Der Entleiher behandelt das Motorrad pfleglich, sichert es beim Abstellen mit dem Lenkschloss und beachtet die Straßenverkehrsordnung.",
    conditions ? { after: 0.6 } : {},
  );
  if (conditions) {
    para(`(5) Der Entleiher beachtet die Auflagen laut Zulassungsbescheinigung (Feld 22): ${conditions}`);
  }

  // --- § 5 ---
  head("§ 5 Versicherung");
  para(
    `Das Motorrad ist bei der ${bike.insurer || BLANK} haftpflichtversichert, Versicherungsscheinnummer ${bike.policyNumber || BLANK}. Die Haftpflichtversicherung deckt Schäden, die Dritten zugefügt werden. Schäden am geliehenen Motorrad selbst sind dadurch nicht abgedeckt.`,
  );

  // --- § 6 ---
  head("§ 6 Haftung des Entleihers");
  para(
    "(1) Der Entleiher haftet für alle Schäden am Motorrad sowie für dessen Verlust (auch Diebstahl), die während der Leihzeit entstehen und die er zu vertreten hat, z. B. bei einem Sturz oder Unfall.",
    { after: 0.6 },
  );
  para(
    `(2) Die Haftung nach Absatz 1 ist auf höchstens ${formatEuro(cap)} (in Worten: ${euroInWords(cap)}) je Schadensfall begrenzt.`,
    { bold: true, after: 0.3 },
  );
  para(
    "Ist der Schaden geringer, zahlt der Entleiher nur den tatsächlichen Schaden (Reparaturkosten laut Rechnung oder Kostenvoranschlag einer Fachwerkstatt). Ein Nachteil durch Höherstufung des Schadenfreiheitsrabatts wird ebenfalls auf den Höchstbetrag angerechnet.",
    { after: 0.6 },
  );
  para(
    "(3) Die Begrenzung nach Absatz 2 gilt nicht, und der Entleiher haftet in voller Höhe, wenn der Schaden vorsätzlich oder grob fahrlässig verursacht wurde, insbesondere bei Fahrten unter Alkohol- oder Drogeneinfluss, ohne gültige Fahrerlaubnis, bei Überlassung an Dritte, bei Rennen oder Unfallflucht.",
    { after: 0.6 },
  );
  para("(4) Für normale Abnutzung bei vertragsgemäßem Gebrauch (§ 602 BGB) haftet der Entleiher nicht.", { after: 0.6 });
  para("(5) Der Betrag ist innerhalb von 30 Tagen nach Vorlage der Rechnung bzw. des Kostenvoranschlags zu zahlen.");

  // --- § 7–9 ---
  head("§ 7 Verhalten bei Unfall, Panne oder Diebstahl");
  para(
    "Der Entleiher informiert den Verleiher unverzüglich. Bei Unfällen mit Fremdbeteiligung sowie bei Diebstahl ist die Polizei hinzuzuziehen. Der Entleiher gibt kein Schuldanerkenntnis ab, sichert Namen und Anschriften der Beteiligten und Zeugen und fertigt Fotos an. Reparaturen dürfen nur mit Zustimmung des Verleihers beauftragt werden.",
  );
  head("§ 8 Haftung des Verleihers");
  para(
    "Der Verleiher haftet nur für Vorsatz und grobe Fahrlässigkeit (§ 599 BGB). Ihm bekannte Mängel teilt er bei Übergabe mit (siehe Anlage: Übergabe- und Rückgabeprotokoll).",
  );
  head("§ 9 Schlussbestimmungen");
  para(
    "Änderungen und Ergänzungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung tritt eine Regelung, die ihrem wirtschaftlichen Zweck am nächsten kommt. Jede Partei erhält eine Ausfertigung dieses Vertrags.",
  );

  // --- Signatures ---
  ensure(42);
  y += 4;
  const sv = signatures.lender ?? null;
  const se = signatures.borrower ?? null;
  font(false, 9);
  doc.text(`Ort, Datum: ${loan.placeDate}`, L, y);
  doc.text(`Ort, Datum: ${loan.placeDate}`, L + 90, y);
  y += 3;
  const sh = 20;
  ([[sv, L], [se, L + 90]] as const).forEach(([s, x]) => {
    if (s) doc.addImage(s.dataUrl, "PNG", x, y, Math.min(78, sh * s.ratio), sh);
  });
  y += sh + 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(L, y, L + 78, y);
  doc.line(L + 90, y, L + 168, y);
  y += 4;
  font(false, 8.5);
  doc.text(`${nameFirstLast(lender.name)} (Verleiher)`, L, y);
  doc.text(`Entleiher${loan.borrowerName ? ` (${nameFirstLast(loan.borrowerName)})` : ""}`, L + 90, y);

  // --- Annex: handover / return protocol ---
  const ident = [title, bike.plate, bike.vin ? `FIN ${bike.vin}` : ""].filter(Boolean).join(" · ");
  doc.addPage();
  y = 18;
  font(true, 15);
  doc.text("Anlage: Übergabe- und Rückgabeprotokoll", 105, y + 2, { align: "center" });
  y += 8;
  font(false, 9.5);
  doc.setTextColor(90);
  doc.text(ident, 105, y, { align: "center" });
  doc.setTextColor(0);
  y += 8;
  const hp = protocols.handover;
  const rp = protocols.return;
  const km = (p?: ContractProtocol | null) => (p?.odometerKm != null ? `${groupThousands(p.odometerKm)} km` : "");
  table(
    [
      ["", "Übergabe", "Rückgabe"],
      ["Datum / Uhrzeit", hp?.datetime ? formatDateTime(hp.datetime) : formatDateTime(loan.startDate, loan.startTime), formatDateTime(rp?.datetime)],
      ["Kilometerstand", km(hp), km(rp)],
      ["Tankstand", hp?.fuelLevel ?? "", rp?.fuelLevel ?? ""],
      ["Vorhandene / neue Schäden", hp?.damages ?? "", rp?.damages ?? ""],
      ["Unterschrift Verleiher", "", ""],
      ["Unterschrift Entleiher", "", ""],
    ],
    [50, 60, 60],
    { headRow: true, minH: [7.5, 9, 9, 9, 45, 18, 18], images: [null, null, null, null, null, [null, sv, null], [null, se, null]] },
  );
  para(
    "Mit der Unterschrift im Protokoll bestätigen beide Parteien den festgehaltenen Zustand des Motorrads bei Übergabe bzw. Rückgabe.",
    { size: 8.5 },
  );

  // --- Photo pages: 2 columns x 3 rows = 6 photos per A4 page ---
  const photoSets: [ContractPhoto[], string][] = [
    [photos.handover, "Übergabe"],
    [photos.return, "Rückgabe"],
  ];
  const cw = 82;
  const ch = 64;
  const gapX = 6;
  const rowH = ch + 12;
  for (const [list, label] of photoSets) {
    list.forEach((ph, i) => {
      const slot = i % 6;
      if (slot === 0) {
        doc.addPage();
        y = 18;
        font(true, 13);
        doc.text(`Fotodokumentation ${label}`, L, y);
        font(false, 8.5);
        doc.setTextColor(90);
        doc.text([title, bike.plate].filter(Boolean).join(" · ") + " · Zeitangabe laut Bilddatei", L, y + 7);
        doc.setTextColor(0);
        y += 13;
      }
      const top = y + Math.floor(slot / 2) * rowH;
      const x = L + (slot % 2) * (cw + gapX);
      const r = Math.min(cw / ph.width, ch / ph.height);
      const w = ph.width * r;
      const h = ph.height * r;
      doc.setDrawColor(200);
      doc.rect(x, top, cw, ch);
      doc.addImage(ph.dataUrl, imageFormat(ph.dataUrl), x + (cw - w) / 2, top + (ch - h) / 2, w, h);
      font(false, 8);
      doc.text(`Foto ${i + 1} · ${formatTimestamp(ph.takenAt)}`, x, top + ch + 4);
    });
  }

  // --- Footer on every page ---
  const n = doc.getNumberOfPages();
  const footer = `Leihvertrag ${[title, bike.plate].filter(Boolean).join(" · ")}`;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    font(false, 7.5);
    doc.setTextColor(120);
    doc.text(footer, L, 289);
    doc.text(`Seite ${i} von ${n}`, 190, 289, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}

/** File name like "Leihvertrag_VFR-750-F_1000EUR_Mustermann_2026-10-23.pdf". */
export function contractFileName(data: ContractData): string {
  const clean = (s: string) => s.replace(/[^\wäöüÄÖÜß-]+/g, "-").replace(/^-+|-+$/g, "");
  const surname = nameLastFirst(data.loan.borrowerName).split(",")[0] || "Entleiher";
  return `Leihvertrag_${clean(data.bike.model) || "Motorrad"}_${Math.round(data.loan.liabilityCapEur)}EUR_${clean(surname)}_${data.loan.startDate || "ohne-Datum"}.pdf`;
}
