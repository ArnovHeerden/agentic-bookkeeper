import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/types.ts"],
      // Thresholds intentionally relaxed until the test suite lands in v0.1.0.
      // Target on first real-tests commit: lines/statements 80, branches 75,
      // functions 80. See README "Production patterns covered" → testing.
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
