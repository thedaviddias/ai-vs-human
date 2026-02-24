import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.ts",
        "convex/classification/**/*.ts",
        "convex/lib/**/*.ts",
        "convex/github/classifyPRs.ts",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "convex/_generated/**",
        // Convex helpers require full Convex runtime (internalMutation/internalQuery)
        "convex/github/classifyPRsHelpers.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
