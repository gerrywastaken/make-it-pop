#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get git commit hash
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.warn('Warning: Could not get git commit hash:', error.message);
}

// Read base manifest from public/
const manifestPath = resolve(__dirname, '../public/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Read version from package.json
const packageJsonPath = resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const baseVersion = packageJson.version;

// Inject version_name with git hash
manifest.version = baseVersion;
manifest.version_name = `${baseVersion}-${gitHash}`;

// Write to dist/
const outputPath = resolve(__dirname, '../dist/manifest.json');
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`✓ Injected version: ${manifest.version_name}`);
