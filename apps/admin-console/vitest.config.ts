import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**/*.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
