// The fixed list of listing categories. Also inserted by the migration drizzle/0001_categories.sql,
// so production has them without seeding demo data. Keep both in sync.
export const CATEGORIES = [
  { slug: "motorrad-leihen", label: "Motorrad zum Leihen", sort: 10 },
  { slug: "garage", label: "Garage / Stellplatz", sort: 20 },
  { slug: "werkzeug", label: "Werkzeug", sort: 30 },
  { slug: "teile", label: "Teile & Zubehör", sort: 40 },
  { slug: "hilfe", label: "Hilfe beim Schrauben", sort: 50 },
  { slug: "tour", label: "Mitfahrer / gemeinsame Tour", sort: 60 },
  { slug: "sonstiges", label: "Sonstiges", sort: 70 },
] as const;
