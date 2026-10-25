import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { normalizeApiBaseUrl } from "./src/services/api-base-url";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const agentOrigin = new URL(normalizeApiBaseUrl(env.VITE_API_URL)).origin;
  return ({
  cacheDir: 'node_modules/.vite/prysm-browser',
  plugins: [
    tailwindcss(),
    react(), // Disable React Compiler - it may be causing production performance issues
  ],
  define: {
    'process.env.NODE_ENV': mode === 'production' ? '"production"' : '"development"',
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: { "/api/agents24": { target: agentOrigin, changeOrigin: true }, "/api/v1/agent": { target: agentOrigin, changeOrigin: true } },
    watch: {
      ignored: ["**/qdrant_storage/**", "**/.agent-data/**", "**/backend/**", "**/docs/**", "**/scripts/**", "**/src/tests/**"],
    },
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    target: "esnext",
    reportCompressedSize: false, // Faster builds
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
          ],
        },
      },
      treeshake: {
        preset: "recommended",
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-router", "@agents24/chat-react/ui", "@agents24/chat-react/runtime"],
  },
});
});
