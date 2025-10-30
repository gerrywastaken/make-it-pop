import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

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
          copyFileSync('public/manifest.json', 'dist/manifest.json');
          copyFileSync('src/settings/settings.html', 'dist/settings.html');
          copyFileSync('src/popup.html', 'dist/popup.html');
        }
      }
    }
  ],
});
