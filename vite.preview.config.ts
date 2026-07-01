import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// One-off build for sending a standalone preview file — not used for the
// real deployment, which keeps the normal multi-file dist/ output.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'preview-dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
})
