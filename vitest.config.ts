import { configDefaults, defineConfig } from "vitest/config";

/** The end-to-end suite needs Go and runs with `npm run test:e2e` (vitest.e2e.config.ts). */
export const E2E_TESTS = ["src/sync/e2e.test.ts"];

// Separate from vite.config.ts so tests run in Node without the PWA and SQLocal plugins
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ...E2E_TESTS],
    environment: "node",
  },
});
