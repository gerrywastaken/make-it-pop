/**
 * Centralized browser API wrapper
 *
 * All browser storage and permission calls should go through this module.
 * This provides:
 * - Single point of control for debugging
 * - Callstack logging when debug mode is enabled
 * - Consistent error handling
 * - Type safety for storage operations
 */

import type { Group, Domain } from './types';

// Browser polyfill for Firefox/Chrome
export const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Debug state (cached to avoid async calls in hot paths)
let debugMode = false;

// Initialize debug mode from storage
browserAPI.storage.local.get('debugMode').then(data => {
  debugMode = data.debugMode || false;
});

// Listen for debug mode changes
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.debugMode) {
    debugMode = changes.debugMode.newValue || false;
  }
});

/**
 * Get a simplified callstack for logging
 */
function getCallstack(): string {
  const stack = new Error().stack || '';
  const lines = stack.split('\n').slice(3, 6); // Skip Error, getCallstack, and the wrapper function
  return lines.map(line => line.trim()).join(' <- ');
}

/**
 * Log a storage operation with callstack when debug mode is enabled
 */
function logOperation(operation: string, key: string, value?: unknown): void {
  if (!debugMode) return;

  const callstack = getCallstack();
  const valuePreview = value !== undefined
    ? ` = ${JSON.stringify(value).slice(0, 100)}${JSON.stringify(value).length > 100 ? '...' : ''}`
    : '';

  console.log(`[MakeItPop Storage] ${operation}(${key})${valuePreview}`);
  console.log(`  ↳ ${callstack}`);
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageKeys {
  groups: Group[];
  domains: Domain[];
  enabled: boolean;
  debugMode: boolean;
  debugUnlocked: boolean;
}

type StorageKey = keyof StorageKeys;

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Get a single value from storage
 */
export async function storageGet<K extends StorageKey>(key: K): Promise<StorageKeys[K] | undefined> {
  logOperation('get', key);
  const data = await browserAPI.storage.local.get(key);
  return data[key];
}

/**
 * Get multiple values from storage
 */
export async function storageGetMultiple<K extends StorageKey>(keys: K[]): Promise<Pick<StorageKeys, K>> {
  logOperation('get', keys.join(', '));
  const data = await browserAPI.storage.local.get(keys);
  return data as Pick<StorageKeys, K>;
}

/**
 * Set a single value in storage
 */
export async function storageSet<K extends StorageKey>(key: K, value: StorageKeys[K]): Promise<void> {
  logOperation('set', key, value);
  await browserAPI.storage.local.set({ [key]: value });
}

/**
 * Set multiple values in storage
 */
export async function storageSetMultiple(values: Partial<StorageKeys>): Promise<void> {
  logOperation('setMultiple', Object.keys(values).join(', '), values);
  await browserAPI.storage.local.set(values);
}

// Type for storage change events
export interface StorageChanges {
  [key: string]: {
    oldValue?: unknown;
    newValue?: unknown;
  };
}

/**
 * Listen for storage changes
 * Returns an unsubscribe function
 */
export function onStorageChanged(
  callback: (changes: StorageChanges) => void
): () => void {
  const listener = (changes: StorageChanges, areaName: string) => {
    // Only handle local storage changes
    if (areaName !== 'local') return;

    if (debugMode) {
      const changedKeys = Object.keys(changes);
      console.log(`[MakeItPop Storage] onChanged: ${changedKeys.join(', ')}`);
    }
    callback(changes);
  };

  browserAPI.storage.onChanged.addListener(listener);

  return () => {
    browserAPI.storage.onChanged.removeListener(listener);
  };
}

// ============================================================================
// High-Level Storage Helpers
// ============================================================================

/**
 * Get all groups from storage
 */
export async function getGroups(): Promise<Group[]> {
  const groups = await storageGet('groups');
  return groups || [];
}

/**
 * Save all groups to storage
 */
export async function saveGroups(groups: Group[]): Promise<void> {
  await storageSet('groups', groups);
}

/**
 * Get all domains from storage
 */
export async function getDomains(): Promise<Domain[]> {
  const domains = await storageGet('domains');
  return domains || [];
}

/**
 * Save all domains to storage
 */
export async function saveDomains(domains: Domain[]): Promise<void> {
  await storageSet('domains', domains);
}

/**
 * Get the enabled state
 */
export async function getEnabled(): Promise<boolean> {
  const enabled = await storageGet('enabled');
  return enabled !== false; // Default to true
}

/**
 * Set the enabled state
 */
export async function setEnabled(enabled: boolean): Promise<void> {
  await storageSet('enabled', enabled);
}

/**
 * Get debug mode state
 */
export async function getDebugMode(): Promise<boolean> {
  const mode = await storageGet('debugMode');
  return mode || false;
}

/**
 * Set debug mode state
 */
export async function setDebugMode(enabled: boolean): Promise<void> {
  await storageSet('debugMode', enabled);
}

// ============================================================================
// Permission Operations
// ============================================================================

/**
 * Request host permissions
 * IMPORTANT: Must be called directly from a user gesture (click event)
 */
export function requestPermissions(origins: string[]): Promise<boolean> {
  if (debugMode) {
    console.log('[MakeItPop Permissions] request:', origins);
    console.log(`  ↳ ${getCallstack()}`);
  }
  return browserAPI.permissions.request({ origins });
}

/**
 * Check if we have specific permissions
 */
export async function hasPermissions(origins: string[]): Promise<boolean> {
  if (debugMode) {
    console.log('[MakeItPop Permissions] contains:', origins);
  }
  return browserAPI.permissions.contains({ origins });
}

/**
 * Remove permissions
 */
export async function removePermissions(origins: string[]): Promise<boolean> {
  if (debugMode) {
    console.log('[MakeItPop Permissions] remove:', origins);
    console.log(`  ↳ ${getCallstack()}`);
  }
  return browserAPI.permissions.remove({ origins });
}
