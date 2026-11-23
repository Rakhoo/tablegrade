import { defineConfig } from "vitest/config";
import { E2E_TESTS } from "./vitest.config.ts";

// Builds and starts the Go server; the first Go build can take a few minutes
export default defineConfig({
  test: {
    include: E2E_TESTS,
    environment: "node",
    hookTimeout: 600_000,
    testTimeout: 30_000,
  },
});
