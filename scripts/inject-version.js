#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version info from generated version.ts
const versionTsPath = resolve(__dirname, '../src/version.ts');
const versionTsContent = readFileSync(versionTsPath, 'utf-8');

// Parse version info from version.ts (simple regex extraction)
const versionMatch = versionTsContent.match(/BUILD_VERSION = '([^']+)'/);
const versionNameMatch = versionTsContent.match(/BUILD_VERSION_NAME = '([^']+)'/);

if (!versionMatch || !versionNameMatch) {
  throw new Error('Could not parse version.ts - run generate-version.js first');
}

const version = versionMatch[1];
const versionName = versionNameMatch[1];

// Read base manifest from public/
const manifestPath = resolve(__dirname, '../public/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Inject version info
manifest.version = version;
manifest.version_name = versionName;

// Write to dist/
const outputPath = resolve(__dirname, '../dist/manifest.json');
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`✓ Injected manifest version: ${versionName}`);
