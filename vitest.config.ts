import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each test file gets its own fresh in-memory database (see tests/helpers/db.ts).
    env: { DATABASE_URL: ":memory:", UPLOAD_DIR: "./data/test-uploads" },
  },
});
