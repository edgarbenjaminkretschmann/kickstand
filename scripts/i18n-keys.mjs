// Collects every translatable string: t("…"), t(lang, "…"), tk("…") and ct("…") in src/.
// Writes src/i18n/keys.json (all German source strings, sorted) and src/i18n/client-keys.json (the ones
// used by browser code via ct), then reports which translations are missing or unused per language.
// Usage: npm run i18n:keys            (report)
//        npm run i18n:keys -- --check (exit 1 if a language misses keys; for CI)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const SRC = path.join(root, "src");
const CALL = /(?<![\w.$])(t|tk|ct)\(\s*(?:[\w.]+\s*,\s*)?"((?:[^"\\\n]|\\.)*)"/g;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(astro|ts|mjs)$/.test(e.name) && !e.name.endsWith(".d.ts")) yield full;
  }
}

const all = new Map();
const client = new Set();
for await (const file of walk(SRC)) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(CALL)) {
    const key = JSON.parse(`"${m[2]}"`);
    if (!all.has(key)) all.set(key, new Set());
    all.get(key).add(path.relative(root, file).split(path.sep).join("/"));
    if (m[1] === "ct") client.add(key);
  }
}

const keys = [...all.keys()].sort((a, b) => a.localeCompare(b, "de"));
await writeFile(path.join(SRC, "i18n/keys.json"), JSON.stringify(Object.fromEntries(keys.map((k) => [k, [...all.get(k)].sort()])), null, 2) + "\n");
await writeFile(path.join(SRC, "i18n/client-keys.json"), JSON.stringify([...client].sort(), null, 2) + "\n");

let missingAny = false;
console.log(`${keys.length} strings (${client.size} used in the browser).`);
for (const lang of ["en", "fr", "es", "it", "pt"]) {
  const dict = JSON.parse(await readFile(path.join(SRC, `i18n/locales/${lang}.json`), "utf8"));
  const missing = keys.filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !all.has(k));
  if (missing.length) missingAny = true;
  console.log(`${lang}: ${keys.length - missing.length}/${keys.length} translated${missing.length ? `, ${missing.length} missing` : ""}${unused.length ? `, ${unused.length} unused` : ""}`);
}
if (process.argv.includes("--check") && missingAny) process.exit(1);
