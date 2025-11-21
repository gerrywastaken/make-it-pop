import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite config for UI development mode
// Run with: pnpm dev:ui
export default defineConfig({
  root: 'src/dev',
  publicDir: false,
  server: {
    port: 5173,
    open: false, // Set to '/settings-dev.html' to auto-open browser
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Redirect version import to dev mock
      '../version': resolve(__dirname, 'src/dev/version.ts'),
    },
  },
});
