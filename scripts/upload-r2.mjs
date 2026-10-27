// Copies every file under UPLOAD_DIR (default ./uploads) into the R2 bucket, keeping the keys.
// Use it after seeding a remote database (the seed writes photos to disk) or when moving an existing server:
//   UPLOAD_DIR=./uploads node scripts/upload-r2.mjs [--local]
// Needs `wrangler login`. --local writes into wrangler dev's local bucket instead of Cloudflare.
import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const wrangler = path.resolve("node_modules/wrangler/bin/wrangler.js");
const BUCKET = process.env.R2_BUCKET || "kickstand-photos";
const root = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const target = process.argv.includes("--local") ? "--local" : "--remote";

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(full);
    else yield full;
  }
}

let n = 0;
for await (const full of files(root)) {
  const key = path.relative(root, full).split(path.sep).join("/");
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  // Runs wrangler's own script with this Node, so no shell is involved (paths may contain spaces).
  execFileSync(process.execPath, [wrangler, "r2", "object", "put", `${BUCKET}/${key}`, "--file", full, "--content-type", type, target], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  n++;
  console.log(`${key}`);
}
console.log(`Uploaded ${n} files to ${BUCKET} (${target.slice(2)}).`);
