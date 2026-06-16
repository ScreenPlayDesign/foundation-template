import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // usePolling required for HMR inside Docker on macOS (VirtioFS).
    // Safe to leave on — no-op when running natively on the host.
    watch: { usePolling: true, interval: 300 },
  },
})
