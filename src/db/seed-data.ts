// Demo data with obviously fake people. Shared by db/seed.ts and the tests.

export const DEMO_PASSWORD = "kickstand-demo";

export const demoUsers = [
  {
    id: "user_demo",
    name: "Erika Mustermann",
    email: "demo@kickstand.test",
    profile: {
      name: "Erika Mustermann",
      street: "Musterstraße 1",
      zipCity: "12345 Musterstadt",
      phone: "0170 0000000",
      birthdate: "1980-01-01",
      licenseNumber: "B000000DEMO",
      licenseClassASince: "2001",
      city: "Musterstadt",
    },
  },
  {
    id: "user_max",
    name: "Max Beispiel",
    email: "max@kickstand.test",
    profile: {
      name: "Beispiel, Max",
      street: "Beispielweg 2",
      zipCity: "54321 Beispielhausen",
      phone: "0171 1111111",
      birthdate: "1990-02-02",
      licenseNumber: "B111111DEMO",
      licenseClassASince: "2012",
      city: "Beispielhausen",
    },
  },
];

export const demoBike = {
  id: "bike_vfr",
  ownerId: "user_demo",
  make: "Honda",
  model: "VFR 750 F",
  typeCode: "RC36",
  plate: "MU-KS 750",
  vin: "HMRC362400700",
  firstRegistration: "1995-05-23",
  powerKw: 74,
  displacementCcm: 748,
  fuel: "Benzin",
  conditions: "Beifahrer nur mit Fußrasten",
  insurer: "Beispiel Versicherung AG",
  policyNumber: "DEMO 000 000/000",
  liabilityCapEur: 1000,
  lendable: true,
};

/** Listing ages are relative to the seed run, so "vor 2 Tagen" stays true-ish. */
const daysAgo = (d: number, now = Date.now()) => new Date(now - d * 86_400_000 - 3_600_000 * (d % 5));

type DemoListing = {
  id: string;
  userId: string;
  type: "biete" | "suche";
  categorySlug: string;
  title: string;
  description: string;
  priceKind: "kostenlos" | "tausch" | "preis" | "vb";
  priceCents?: number | null;
  zip: string;
  city: string;
  country?: string;
  bikeId?: string | null;
  createdAt: Date;
  /** File in public/images to copy in as the cover photo. */
  photo?: string;
};

export const demoListings: DemoListing[] = [
  {
    id: "listing_vfr",
    userId: "user_demo",
    type: "biete",
    categorySlug: "motorrad-leihen",
    title: "Honda VFR 750 F zum Leihen, ideal für Touren",
    description:
      "Meine VFR (RC36) steht unter der Woche oft. Wer sie für ein Wochenende oder ein paar Wochen braucht, meldet sich. Kostenlos, mit Leihvertrag und Haftungsgrenze 1.000 € je Schaden. Koffer können mit.",
    priceKind: "kostenlos",
    zip: "12345",
    city: "Musterstadt",
    bikeId: "bike_vfr",
    createdAt: daysAgo(2),
  },
  {
    id: "listing_tour_pt",
    userId: "user_demo",
    type: "suche",
    categorySlug: "tour",
    title: "Mitfahrer für Enduro-Runde Serra da Estrela",
    description: "Im März drei, vier Tage Schotter und Bergstraßen ab Porto. Gemütliches Tempo, Zelt oder Pension. Eigene Enduro nötig.",
    priceKind: "kostenlos",
    zip: "4000",
    city: "Porto",
    country: "PT",
    createdAt: daysAgo(1),
    photo: "myanmar-1200.webp",
  },
  {
    id: "listing_garage_winter",
    userId: "user_demo",
    type: "biete",
    categorySlug: "garage",
    title: "Stellplatz im Winter frei, trocken und mit Strom",
    description: "Platz für eine Maschine von November bis März. Steckdose für das Ladegerät ist da, Zugang nach Absprache.",
    priceKind: "preis",
    priceCents: 2500,
    zip: "04109",
    city: "Leipzig",
    createdAt: daysAgo(4),
  },
  {
    id: "listing_hebebuehne",
    userId: "user_demo",
    type: "biete",
    categorySlug: "hilfe",
    title: "Hebebühne und Hilfe beim Reifenwechsel",
    description: "Trockene Garage mit Motorradheber. Samstags meistens offen, gern mit Kaffee. Reifen bitte selbst mitbringen.",
    priceKind: "kostenlos",
    zip: "12345",
    city: "Musterstadt",
    createdAt: daysAgo(6),
  },
  {
    id: "listing_auspuff",
    userId: "user_demo",
    type: "biete",
    categorySlug: "teile",
    title: "Original-Auspuff VFR 750 RC36, guter Zustand",
    description: "Serienanlage, nach Umbau übrig. Keine Dellen, Halter vollständig. Abholung oder Versand gegen Aufpreis.",
    priceKind: "vb",
    priceCents: 12000,
    zip: "12345",
    city: "Musterstadt",
    createdAt: daysAgo(9),
  },
  {
    id: "listing_drehmoment",
    userId: "user_demo",
    type: "suche",
    categorySlug: "werkzeug",
    title: "Drehmomentschlüssel 40–200 Nm für ein Wochenende",
    description: "Für Achsmuttern und Kettenrad. Bringe ihn sauber zurück, gern gegen ein Bier.",
    priceKind: "tausch",
    zip: "12345",
    city: "Musterstadt",
    createdAt: daysAgo(12),
  },
  {
    id: "listing_montagestaender",
    userId: "user_max",
    type: "biete",
    categorySlug: "werkzeug",
    title: "Montageständer hinten zu verleihen",
    description: "Für Bikes mit Schwingenaufnahme oder Bobbins. Einfach melden, wann du ihn brauchst.",
    priceKind: "kostenlos",
    zip: "54321",
    city: "Beispielhausen",
    createdAt: daysAgo(3),
  },
  {
    id: "listing_ventilspiel",
    userId: "user_max",
    type: "suche",
    categorySlug: "hilfe",
    title: "Ventilspiel einstellen, wer hilft?",
    description: "Ich würde es gern selbst machen und mir einmal zeigen lassen. Werkzeug ist da, Kaffee auch.",
    priceKind: "kostenlos",
    zip: "54321",
    city: "Beispielhausen",
    createdAt: daysAgo(0),
  },
  {
    id: "listing_enduro_pt",
    userId: "user_max",
    type: "suche",
    categorySlug: "motorrad-leihen",
    title: "Suche Enduro für zwei Wochen an der Algarve",
    description: "Ich bin im Februar in Faro und würde gern eine leichte Enduro leihen. Führerschein A seit 2012, fahre vorsichtig.",
    priceKind: "kostenlos",
    zip: "8000",
    city: "Faro",
    country: "PT",
    createdAt: daysAgo(5),
  },
  {
    id: "listing_stellplatz_lissabon",
    userId: "user_max",
    type: "suche",
    categorySlug: "garage",
    title: "Stellplatz in Lissabon für drei Monate",
    description: "Ab Januar, möglichst überdacht. Ich komme regelmäßig vorbei und halte alles sauber.",
    priceKind: "vb",
    priceCents: 6000,
    zip: "1100",
    city: "Lissabon",
    country: "PT",
    createdAt: daysAgo(8),
  },
  {
    id: "listing_kupplungshebel",
    userId: "user_max",
    type: "suche",
    categorySlug: "teile",
    title: "Kupplungshebel für Africa Twin CRF1000L",
    description: "Original oder gutes Nachbauteil. Nach einem Umfaller abgebrochen.",
    priceKind: "preis",
    priceCents: 2000,
    zip: "54321",
    city: "Beispielhausen",
    createdAt: daysAgo(11),
  },
  {
    id: "listing_harzrunde",
    userId: "user_max",
    type: "biete",
    categorySlug: "tour",
    title: "Sonntagsrunde Harz, noch zwei Plätze frei",
    description: "Start 9 Uhr in Goslar, etwa 250 km, Mittag unterwegs. Jedes Tempo ist willkommen, niemand wird abgehängt.",
    priceKind: "kostenlos",
    zip: "38640",
    city: "Goslar",
    createdAt: daysAgo(7),
  },
  {
    id: "listing_helm",
    userId: "user_max",
    type: "biete",
    categorySlug: "sonstiges",
    title: "Motorradhelm Größe M, kaum getragen",
    description: "Integralhelm, zwei Saisons alt, nie gestürzt. Tausche gern gegen Größe L.",
    priceKind: "tausch",
    zip: "54321",
    city: "Beispielhausen",
    createdAt: daysAgo(15),
  },
];

/** Max asks Erika about the VFR again. The last message is unread for Erika. */
export const demoConversation = {
  id: "conv_vfr",
  listingId: "listing_vfr",
  buyerId: "user_max",
  sellerId: "user_demo",
  messages: [
    { id: "msg_vfr_1", senderId: "user_max", body: "Hallo Erika, die VFR war im Mai super. Hättest du sie Mitte November nochmal für ein Wochenende frei?", hoursAgo: 30 },
    { id: "msg_vfr_2", senderId: "user_demo", body: "Hallo Max, klar. Vom 14. bis 16. November passt es mir gut. Den Vertrag machen wir wieder bei der Übergabe.", hoursAgo: 26, read: true },
    { id: "msg_vfr_3", senderId: "user_max", body: "Perfekt, dann komme ich am Freitag um 17 Uhr vorbei. Ich bringe meinen Helm mit.", hoursAgo: 3 },
  ],
};

/** Erika's Merkliste. */
export const demoSaved = [
  { userId: "user_demo", listingId: "listing_montagestaender" },
  { userId: "user_demo", listingId: "listing_harzrunde" },
];

// A finished loan, so the dashboard and the PDF have something to show.
export const demoLoan = {
  id: "loan_demo",
  bikeId: "bike_vfr",
  lenderId: "user_demo",
  status: "returned",
  borrowerName: "Beispiel, Max",
  borrowerStreet: "Beispielweg 2",
  borrowerZipCity: "54321 Beispielhausen",
  borrowerBirthdate: "1990-02-02",
  borrowerPhone: "0171 1111111",
  licenseNumber: "B111111DEMO",
  licenseClassASince: "2012",
  startDate: "2026-05-01",
  startTime: "10:00",
  endMode: "open",
  endDate: null,
  endTime: null,
  latestEndDate: "2026-09-30",
  returnPlace: "Musterstraße 1, 12345 Musterstadt",
  liabilityCapEur: 1000,
  handedOverItems: { keys: true, keyCount: 2, registration: true, other: "Kettenschloss" },
  placeDate: "Musterstadt, 01.05.2026",
  listingId: "listing_vfr",
  conversationId: "conv_vfr",
};

export const demoProtocols = [
  { id: "proto_demo_h", loanId: "loan_demo", kind: "handover", datetime: "2026-05-01T10:00", odometerKm: 81250, fuelLevel: "voll", damages: "Kratzer Tank links, Spiegel rechts lose" },
  { id: "proto_demo_r", loanId: "loan_demo", kind: "return", datetime: "2026-05-14T18:30", odometerKm: 82410, fuelLevel: "voll", damages: "keine neuen Schäden" },
];
