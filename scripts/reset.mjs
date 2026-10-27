// Deletes the local SQLite file so db:migrate + db:seed start from scratch. Refuses non-file URLs.
import { rmSync } from "node:fs";

const url = process.env.DATABASE_URL || "file:./data/kickstand.db";
if (!url.startsWith("file:")) {
  console.error(`Refusing to reset a non-file database (${url}).`);
  process.exit(1);
}
const file = url.slice("file:".length);
try {
  for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) rmSync(f, { force: true });
} catch (e) {
  if (e.code === "EPERM" || e.code === "EBUSY") {
    console.error(`${file} is in use. Stop the dev server (or anything else using the database) and try again.`);
    process.exit(1);
  }
  throw e;
}
console.log(`Deleted ${file}`);
