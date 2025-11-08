import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const entry = process.env.ENTRY || 'content';
const entryPath = entry === 'settings' ? 'src/settings/settings.ts' : `src/${entry}.ts`;

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: entry === 'content', // Only empty on first build
    lib: {
      entry: resolve(__dirname, entryPath),
      name: entry,
      formats: ['iife'],
      fileName: () => `${entry}.js`,
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  plugins: [
    {
      name: 'copy-files',
      closeBundle() {
        if (entry === 'settings') {
          // Copy static files after final build
          try { mkdirSync('dist', { recursive: true }); } catch {}

          // Inject version with git commit hash into manifest.json
          try {
            execSync('node scripts/inject-version.js', { stdio: 'inherit' });
          } catch (error) {
            console.error('Error injecting version:', error);
            // Fallback to direct copy if script fails
            copyFileSync('public/manifest.json', 'dist/manifest.json');
          }

          copyFileSync('src/settings/settings.html', 'dist/settings.html');
          copyFileSync('src/settings/settings.css', 'dist/settings.css');
          copyFileSync('src/popup.html', 'dist/popup.html');
          copyFileSync('src/popup.css', 'dist/popup.css');
        }
      }
    }
  ],
});
