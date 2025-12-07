import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSON5 from 'json5';
import type { Group, Domain } from './types';

/**
 * Smoke test that exercises the same code paths as settings.ts button handlers.
 * If dependencies are missing or wired incorrectly, these tests fail.
 *
 * These tests specifically verify that calling functions WITHOUT proper arguments
 * fails - which is what would happen if settings.ts wired them incorrectly.
 */

// Test data matching what settings.ts would have
const testGroups: Group[] = [{
  id: 'group-1',
  name: 'Test Group',
  enabled: true,
  lightBgColor: '#ffff00',
  lightTextColor: '#000000',
  darkBgColor: '#3a3a00',
  darkTextColor: '#ffffff',
  phrases: ['test phrase'],
}];

const testDomains: Domain[] = [{
  id: 'domain-1',
  domain: 'example.com',
  matchMode: 'all-subdomains',
  mode: 'light',
}];

describe('settings.ts smoke tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('export code path: exportData(groups, domains) produces valid JSON5', async () => {
    // Mock storage since importExport uses it
    vi.doMock('./utils/storage', () => ({
      saveGroups: vi.fn(),
      saveDomains: vi.fn(),
    }));

    const { exportData } = await import('./utils/importExport');

    // This is how settings.ts SHOULD call it
    const result = await exportData(testGroups, testDomains);

    const parsed = JSON5.parse(result);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].name).toBe('Test Group');
    expect(parsed.domains).toHaveLength(1);
    expect(parsed.domains[0].domain).toBe('example.com');
  });

  it('export code path: exportData() without args throws (catches wrong wiring)', async () => {
    vi.doMock('./utils/storage', () => ({
      saveGroups: vi.fn(),
      saveDomains: vi.fn(),
    }));

    const { exportData } = await import('./utils/importExport');

    // This is how settings.ts was INCORRECTLY calling it
    // @ts-expect-error - intentionally calling without required args
    await expect(exportData()).rejects.toThrow();
  });

  it('permission code path: domainToHostPatterns(domain) returns valid origins', async () => {
    const { domainToHostPatterns } = await import('./utils/permissions');

    // This is how settings.ts SHOULD call it
    const origins = domainToHostPatterns(testDomains[0]);

    expect(origins).toContain('*://*.example.com/*');
    expect(origins).toContain('*://example.com/*');
  });

  it('group rename: updates domain references when group name changes', async () => {
    // Setup: Create a domain that references a group by name
    let storedDomains: Domain[] = [{
      id: 'domain-1',
      domain: 'example.com',
      matchMode: 'domain-and-www',
      mode: 'light',
      groups: ['Old Name'],  // References the group by name
      groupMode: 'only',
    }];

    // Clear any previous mocks and import the REAL module
    vi.doUnmock('./utils/storage');
    const { updateDomainReferencesAfterGroupRename } = await import('./utils/storage');

    // Test the REAL function with mock storage dependencies via dependency injection
    const wasUpdated = await updateDomainReferencesAfterGroupRename('Old Name', 'New Name', {
      getDomains: async () => storedDomains,
      saveDomains: async (domains) => { storedDomains = domains; },
    });

    // Verify: Domain reference should be updated to new name
    expect(wasUpdated).toBe(true);
    expect(storedDomains[0].groups).toContain('New Name');
    expect(storedDomains[0].groups).not.toContain('Old Name');
  });
});
