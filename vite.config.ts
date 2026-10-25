import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import { normalizeApiBaseUrl } from './src/services/api-base-url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const apiBaseUrl = normalizeApiBaseUrl(env.VITE_API_URL)
  const apiOrigin = new URL(apiBaseUrl).origin
  const electronOutDir = env.PRYSM_DEV_DATA_DIR ? '.agent-data/electron-build' : 'dist-electron'
  
  return {
    cacheDir: 'node_modules/.vite/prysm-electron',
    plugins: [
      tailwindcss(),
      react(),
      electron([
        {
          // Main process entry file
          entry: 'src/main.ts',
          onstart: env.PRYSM_DEV_DATA_DIR
            ? ({ startup }) => startup([path.resolve(configDir, electronOutDir, 'main.js')])
            : undefined,
          vite: {
            define: { '__PRYSM_AGENT_API_URL__': JSON.stringify(apiBaseUrl) },
            resolve: {
              alias: {
                '@': path.resolve(configDir, './src'),
              }
            },
            build: {
              sourcemap: false,
              minify: mode === 'production',
              outDir: electronOutDir,
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
                  'googleapis',
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
              outDir: electronOutDir,
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
      'process.env.GOOGLE_DESKTOP_CLIENT_ID': JSON.stringify(env.GOOGLE_DESKTOP_CLIENT_ID || ''),
      'process.env.GOOGLE_DESKTOP_CLIENT_SECRET': JSON.stringify(env.GOOGLE_DESKTOP_CLIENT_SECRET || ''),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(configDir, './src'),
      },
    },
    server: {
      port: 5126,
      proxy: {
        '/api/agents24': { target: apiOrigin, changeOrigin: true },
        '/api/v1/agent': { target: apiOrigin, changeOrigin: true },
      },
      watch: {
        ignored: ['**/qdrant_storage/**', '**/release/**', '**/dist-electron/**', '**/.agent-data/**', '**/backend/**', '**/docs/**', '**/scripts/**', '**/src/tests/**'],
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
      include: ['react', 'react-dom', '@tanstack/react-router', '@agents24/chat-react/ui', '@agents24/chat-react/runtime'],
    },
  }
})
