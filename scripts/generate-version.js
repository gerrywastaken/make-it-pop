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

// Read version from package.json
const packageJsonPath = resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const baseVersion = packageJson.version;

// Build version strings
const version = baseVersion;
const versionName = `${baseVersion}-${gitHash}`;
const buildTime = new Date().toISOString();

// Generate TypeScript version file
const versionTs = `// Auto-generated during build - DO NOT EDIT
export const BUILD_VERSION = '${version}';
export const BUILD_VERSION_NAME = '${versionName}';
export const BUILD_COMMIT = '${gitHash}';
export const BUILD_TIME = '${buildTime}';
`;

// Write to src/
const outputPath = resolve(__dirname, '../src/version.ts');
writeFileSync(outputPath, versionTs);

console.log(`✓ Generated version.ts: ${versionName}`);
