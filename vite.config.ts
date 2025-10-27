import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    electron([
      {
        // Main process entry file
        entry: 'src/main.ts',
        vite: {
          resolve: {
            alias: {
              '@': path.resolve(__dirname, './src'),
            }
          },
          build: {
            sourcemap: false,
            minify: mode === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'better-sqlite3',
                'electron',
                'path',
                'fs',
                'express',
                'cors',
                'os',
                'http',
                'https',
                'net',
                'tls',
                'crypto',
                'stream',
                'zlib',
                'events',
                'util',
              ]
            }
          }
        }
      },
      {
        // Preload script
        entry: 'src/preload.ts',
        onstart({ reload }) {
          // Reload renderer process when preload script changes
          reload()
        },
        vite: {
          build: {
            sourcemap: false,
            minify: mode === 'production',
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    electronRenderer()
  ],
  define: {
    'process.env.NODE_ENV': mode === 'production' ? '"production"' : '"development"',
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      ignored: ['**/qdrant_storage/**', '**/release/**', '**/dist-electron/**'],
    },
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    outDir: 'dist',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
          ],
        },
      },
      treeshake: {
        preset: 'recommended',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-router'],
  },
}))

