import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Ignore editor/tooling atomic-write temp artifacts (e.g.
  // ".File.tsx.<pid>.<uuid>.tmpdir/File.tsx.tmp"). Vite's file watcher otherwise
  // tries to fs.watch them; on Windows that throws EBUSY and crashes the dev server.
  server: {
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
