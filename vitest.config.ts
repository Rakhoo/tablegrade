import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests run in Node without the PWA and SQLocal plugins
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
