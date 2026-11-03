// The fixed list of listing categories. Also inserted by the migration drizzle/0001_categories.sql,
// so production has them without seeding demo data. Keep both in sync.
// Labels are stored in German and translated where they are shown: t(lang, category.label).
import { tk } from "../i18n";

export const CATEGORIES = [
  { slug: "motorrad-leihen", label: tk("Motorrad zum Leihen"), sort: 10 },
  { slug: "garage", label: tk("Garage / Stellplatz"), sort: 20 },
  { slug: "werkzeug", label: tk("Werkzeug"), sort: 30 },
  { slug: "teile", label: tk("Teile & Zubehör"), sort: 40 },
  { slug: "hilfe", label: tk("Hilfe beim Schrauben"), sort: 50 },
  { slug: "tour", label: tk("Mitfahrer / gemeinsame Tour"), sort: 60 },
  { slug: "sonstiges", label: tk("Sonstiges"), sort: 70 },
] as const;
