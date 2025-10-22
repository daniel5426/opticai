import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    sourcemap: false, // Disable source maps in production
    minify: "esbuild",
    target: "esnext",
  }
});
