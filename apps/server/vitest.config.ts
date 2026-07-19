import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    // Quiet pino / app logs during unit tests
    env: {
      LOG_LEVEL: "silent",
    },
  },
});
