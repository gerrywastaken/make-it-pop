import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const entry = process.env.ENTRY || 'content';
const entryPath = entry === 'settings' ? 'src/settings/settings.ts' : `src/${entry}.ts`;

export default defineConfig(({ command }) => ({
  build: {
    outDir: 'dist',
    emptyOutDir: entry === 'content' && command === 'build', // Only empty on production builds
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

          // Preserve settings directory structure for correct relative paths
          try { mkdirSync('dist/settings', { recursive: true }); } catch {}
          try { mkdirSync('dist/styles', { recursive: true }); } catch {}
          copyFileSync('src/settings/settings.html', 'dist/settings/settings.html');
          // Copy settings.js to settings folder (built to dist root, needed in subfolder)
          copyFileSync('dist/settings.js', 'dist/settings/settings.js');
          // Copy styles
          copyFileSync('src/styles/shared.css', 'dist/styles/shared.css');
          copyFileSync('src/styles/settings.css', 'dist/styles/settings.css');
          copyFileSync('src/styles/popup.css', 'dist/styles/popup.css');
          copyFileSync('src/popup.html', 'dist/popup.html');
        }
      }
    }
  ],
}));
