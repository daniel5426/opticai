import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  build: {
    sourcemap: false, // Disable source maps in production
    minify: "esbuild",
    target: "node18",
    rollupOptions: {
      external: ['better-sqlite3', 'electron', 'path', 'fs', 'express', 'cors', 'os', 'http']
    }
  }
});
