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
        // Browser-only: Web Audio API — requires AudioContext, not available in Node
        "lib/sounds.ts",
        // React hooks: require React testing environment (jsdom / @testing-library)
        "lib/hooks/**",
        // Thin config wrappers: call third-party constructors with no testable logic
        "lib/auth-client.ts",
        "lib/auth-server.ts",
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
