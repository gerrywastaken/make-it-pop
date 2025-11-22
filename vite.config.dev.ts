import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite config for UI development mode
// Run with: pnpm dev:ui
export default defineConfig({
  root: 'src', // Use src as root so we can access both dev/ and settings/
  publicDir: false,
  server: {
    port: 5173,
    open: false, // Set to '/dev/settings-dev.html' or '/dev/popup-dev.html' to auto-open browser
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Redirect version import to dev mock
      '../version': resolve(__dirname, 'src/dev/version.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/dev/settings-dev.html'),
      },
    },
  },
  optimizeDeps: {
    // Only scan the dev HTML files, not popup.html or settings.html
    entries: ['dev/settings-dev.html', 'dev/popup-dev.html'],
  },
});
