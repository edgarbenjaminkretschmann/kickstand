// Checks the Worker bundle written by `wrangler deploy --dry-run --outdir <dir>` (npm run check:bundle):
// no native libSQL client, no sharp, no node:fs imports. Exits 1 and lists the hits otherwise.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.argv[2] || "dist-check");
const CHECKS = [
  ["native libSQL", /@libsql\/(?:linux|darwin|win32)|libsql\.node|libsql-js/],
  ["native addon", /require\(["'][^"']+\.node["']\)/],
  ["sharp", /["']sharp["']/],
  ["node:fs", /(?:from\s*|import\(\s*|require\(\s*)["'](?:node:)?fs(?:\/promises)?["']/],
];

async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(m?js|cjs)$/.test(e.name)) yield full;
  }
}

let files = 0;
let bytes = 0;
const hits = [];
for await (const file of walk(dir)) {
  const text = await readFile(file, "utf8");
  files++;
  bytes += text.length;
  for (const [label, re] of CHECKS) {
    const m = re.exec(text);
    if (m) hits.push(`${label}: ${path.relative(dir, file)} … ${text.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, " ")}`);
  }
}
console.log(`Checked ${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB) in ${dir}.`);
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("No native libSQL, sharp or node:fs in the Worker bundle.");
