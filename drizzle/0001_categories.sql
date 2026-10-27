-- Listing categories are reference data, needed in every environment. Keep in sync with src/db/categories.ts.
INSERT INTO "category" ("slug", "label", "sort") VALUES
  ('motorrad-leihen', 'Motorrad zum Leihen', 10),
  ('garage', 'Garage / Stellplatz', 20),
  ('werkzeug', 'Werkzeug', 30),
  ('teile', 'Teile & Zubehör', 40),
  ('hilfe', 'Hilfe beim Schrauben', 50),
  ('tour', 'Mitfahrer / gemeinsame Tour', 60),
  ('sonstiges', 'Sonstiges', 70)
ON CONFLICT ("slug") DO NOTHING;
