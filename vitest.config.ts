import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["shared/**", "adapters/**", "services/**/src/**"],
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "shared"),
      "@adapters": resolve(__dirname, "adapters"),
    },
  },
});
