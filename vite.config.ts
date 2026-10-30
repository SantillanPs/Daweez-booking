import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Every build is stamped with its own version, written into the app and into `version.json` beside it,
// so a screen left open can tell an update has gone live and reload itself (`utils/appUpdate.ts`;
// Sebastian, 2026-10-30: "I hate that in the live after an update they are always required to refresh").
const version = process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)
function stampVersion(): Plugin {
  return {
    name: 'stamp-version',
    config: () => ({ define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) } }),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stampVersion()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Ignore editor/tooling atomic-write temp artifacts (e.g.
  // ".File.tsx.<pid>.<uuid>.tmpdir/File.tsx.tmp"). Vite's file watcher otherwise
  // tries to fs.watch them; on Windows that throws EBUSY and crashes the dev server.
  server: {
    // The preview pane hands out a free port in PORT when 5173 is taken by
    // another project's dev server; Vite does not read PORT by itself.
    port: Number(process.env.PORT) || 5173,
    watch: {
      ignored: [
        '**/*.tmp',
        '**/.*.tmpdir',
        '**/*.tmpdir/**',
      ],
    },
  },
  // Pre-bundle chart deps at server startup. They are only reachable through the
  // lazy /analytics route, so Vite otherwise discovers them on first navigation
  // and answers 504 "Outdated Optimize Dep", which fails the dynamic import as
  // "Failed to fetch dynamically imported module".
  optimizeDeps: {
    include: [
      '@tanstack/charts',
      '@tanstack/charts/polar',
      '@tanstack/charts/react',
      '@tanstack/charts/scales/band',
      '@tanstack/charts/scales/linear',
      '@tanstack/charts/scales/ordinal',
    ],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          router: ['@tanstack/react-router'],
        },
      },
    },
  },
})
