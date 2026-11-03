// `--remote` for the database scripts: loads the Turso URL and token from the git-ignored .env.turso
// (DATABASE_URL=libsql://..., DATABASE_AUTH_TOKEN=...) instead of using the local SQLite file.
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

export const isRemote = process.argv.includes("--remote");

/** Loads .env.turso when --remote is given. Returns the database URL the script will use. */
export function loadRemoteEnv() {
  if (!isRemote) return process.env.DATABASE_URL || "file:./data/kickstand.db";
  if (!existsSync(".env.turso")) {
    console.error("--remote needs .env.turso with DATABASE_URL and DATABASE_AUTH_TOKEN (see README).");
    process.exit(1);
  }
  process.loadEnvFile(".env.turso");
  const url = process.env.DATABASE_URL || "";
  if (!/^(libsql|https?):\/\//.test(url) || !process.env.DATABASE_AUTH_TOKEN) {
    console.error(".env.turso must set a libsql:// DATABASE_URL and DATABASE_AUTH_TOKEN.");
    process.exit(1);
  }
  return url;
}

/** Asks before a destructive step on the remote database; --yes skips the question. */
export async function confirmRemote(question) {
  if (!isRemote || process.argv.includes("--yes")) return;
  if (!process.stdin.isTTY) {
    console.error(`${question} Pass --yes to confirm when running without a terminal.`);
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} Type "ja" to continue: `);
  rl.close();
  if (answer.trim().toLowerCase() !== "ja") {
    console.error("Aborted.");
    process.exit(1);
  }
}
