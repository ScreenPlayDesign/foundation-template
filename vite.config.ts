import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// The app lives in frontend/ (src/, public/, index.html) — kept separate
// from supabase/, screenplay/, and scripts/ at the repo root, the same
// encapsulation fastnacht-lancaster gets from apps/web/. This file stays
// at the repo root itself so `vite`/`vite build` (no args) keep working
// from package.json's scripts with zero changes — only `root` moves.
export default defineConfig({
  root: 'frontend',
  // .env files are project-wide (also read by scripts/seed-actors.ts,
  // supabase config, etc.) — keep them resolving from the true repo root,
  // not frontend/, even though root has moved.
  envDir: path.resolve(process.cwd()),
  plugins: [react(), tailwindcss()],
  build: {
    // Vite's default outDir is relative to `root` — override so dist/
    // lands at the repo root, matching what Dockerfile/CI already expect.
    outDir: path.resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    // usePolling required for HMR inside Docker on macOS (VirtioFS).
    // Safe to leave on — no-op when running natively on the host.
    watch: { usePolling: true, interval: 300 },
  },
})
