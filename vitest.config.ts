import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    dir: "./src/tests/unit",
    globals: true,
    // Keep DOM suites isolated without oversubscribing local builds and CI runners.
    maxWorkers: 4,
    minWorkers: 1,
    environment: "jsdom",
    setupFiles: "./src/tests/unit/setup.ts",
    css: true,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*"],
      exclude: [],
    },
    env: {
      VITE_API_URL: "http://localhost:8001/api/v1",
    },
  },
});
