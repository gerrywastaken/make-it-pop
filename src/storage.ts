import type { Group, Domain, StorageData } from './types';
import JSON5 from 'json5';

// Browser polyfill for Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Export format types (user-friendly, no IDs)
interface ExportGroup {
  name: string;
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
  phrases: string[];
}

interface ExportDomain {
  pattern: string;
  mode: 'light' | 'dark';
  groups: string[]; // group names instead of IDs
}

interface ExportData {
  groups: ExportGroup[];
  domains: ExportDomain[];
}

export async function getGroups(): Promise<Group[]> {
  const data = await browserAPI.storage.local.get('groups');
  return data.groups || [];
}

export async function saveGroups(groups: Group[]): Promise<void> {
  await browserAPI.storage.local.set({ groups });
}

export async function getDomains(): Promise<Domain[]> {
  const data = await browserAPI.storage.local.get('domains');
  return data.domains || [];
}

export async function saveDomains(domains: Domain[]): Promise<void> {
  await browserAPI.storage.local.set({ domains });
}

/**
 * Convert domain config to host permission patterns
 */
export function domainToHostPatterns(domainConfig: Domain): string[] {
  const { domain, matchMode } = domainConfig;
  const patterns: string[] = [];

  switch (matchMode) {
    case 'domain-and-www':
      // Handle domains that already have www. prefix
      if (domain.startsWith('www.')) {
        // Domain is www.example.com -> match www.example.com and example.com
        patterns.push(`*://${domain}/*`);
        patterns.push(`*://${domain.substring(4)}/*`); // Remove 'www.'
      } else {
        // Domain is example.com -> match example.com and www.example.com
        patterns.push(`*://${domain}/*`);
        patterns.push(`*://www.${domain}/*`);
      }
      break;
    case 'all-subdomains':
      patterns.push(`*://*.${domain}/*`);
      patterns.push(`*://${domain}/*`); // Include base domain
      break;
    case 'exact':
      patterns.push(`*://${domain}/*`);
      break;
  }

  return patterns;
}

/**
 * Add or update a domain with automatic permission request
 * IMPORTANT: This must be called directly from a user gesture (like a click event)
 * @param domain The domain to add or update
 * @returns Promise<boolean> - true if permission was granted, false if denied
 * @throws Error if storage operation fails (caller should handle with .catch())
 */
export function addOrUpdateDomainWithPermission(domain: Domain): Promise<boolean> {
  // Request permissions FIRST (must be directly from user gesture, before any async operations)
  // IMPORTANT: Cannot use async/await - Firefox requires direct call from user action
  const origins = domainToHostPatterns(domain);
  console.log('[MakeItPop] Requesting permissions for:', origins);

  return browserAPI.permissions.request({ origins })
    .then(async granted => {
      console.log('[MakeItPop] Permission granted:', granted);

      // Now save the domain (regardless of permission result)
      // Always read fresh data from storage to avoid overwriting concurrent changes
      const data = await browserAPI.storage.local.get('domains');
      const domains = data.domains || [];

      const existingIndex = domains.findIndex(d => d.id === domain.id);
      if (existingIndex !== -1) {
        // Update existing domain
        domains[existingIndex] = domain;
      } else {
        // Add new domain
        domains.push(domain);
      }

      await saveDomains(domains);
      return granted;
    })
    .catch(error => {
      // Only catch permission request errors, let storage errors propagate
      if (error.message && error.message.includes('permissions')) {
        console.error('[MakeItPop] Permission request failed:', error);
        throw error;
      }
      // Re-throw storage errors so caller can handle them
      console.error('[MakeItPop] Storage error while adding domain:', error);
      throw error;
    });
}

export async function exportData(): Promise<string> {
  const groups = await getGroups();
  const domains = await getDomains();

  // Convert to export format (no IDs, name-based references)
  const exportGroups: ExportGroup[] = groups.map(g => ({
    name: g.name,
    lightBg: g.lightBgColor,
    lightText: g.lightTextColor,
    darkBg: g.darkBgColor,
    darkText: g.darkTextColor,
    phrases: g.phrases,
  }));

  // Build ID to name map for groups
  const idToName = new Map(groups.map(g => [g.id, g.name]));

  const exportDomains: ExportDomain[] = domains.map(d => ({
    pattern: d.pattern,
    mode: d.mode,
    groups: d.groupIds.map(id => idToName.get(id) || id).filter(Boolean),
  }));

  const data: ExportData = { groups: exportGroups, domains: exportDomains };

  // Use JSON5 stringify for cleaner output (no quotes on keys)
  return JSON5.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse with JSON5 to support relaxed syntax
    const data = JSON5.parse(jsonString) as ExportData;

    // Validate the structure
    if (!data.groups || !Array.isArray(data.groups)) {
      return { success: false, error: 'Invalid format: missing or invalid "groups" array' };
    }
    if (!data.domains || !Array.isArray(data.domains)) {
      return { success: false, error: 'Invalid format: missing or invalid "domains" array' };
    }

    // Convert groups to internal format with generated IDs
    const nameToId = new Map<string, string>();
    const groups: Group[] = [];

    for (const exportGroup of data.groups) {
      // Validate group
      if (!exportGroup.name || !exportGroup.phrases || !Array.isArray(exportGroup.phrases)) {
        return { success: false, error: `Invalid group format: missing required fields (name: "${exportGroup.name || 'missing'}")` };
      }
      if (!exportGroup.lightBg || !exportGroup.lightText || !exportGroup.darkBg || !exportGroup.darkText) {
        return { success: false, error: `Invalid group "${exportGroup.name}": missing color fields` };
      }

      // Check for duplicate group names
      if (nameToId.has(exportGroup.name)) {
        return { success: false, error: `Duplicate group name: "${exportGroup.name}"` };
      }

      const id = crypto.randomUUID();
      nameToId.set(exportGroup.name, id);

      groups.push({
        id,
        name: exportGroup.name,
        lightBgColor: exportGroup.lightBg,
        lightTextColor: exportGroup.lightText,
        darkBgColor: exportGroup.darkBg,
        darkTextColor: exportGroup.darkText,
        phrases: exportGroup.phrases,
      });
    }

    // Convert domains to internal format
    const domains: Domain[] = [];

    for (const exportDomain of data.domains) {
      // Validate domain
      if (!exportDomain.pattern || !exportDomain.mode || !exportDomain.groups || !Array.isArray(exportDomain.groups)) {
        return { success: false, error: `Invalid domain format: missing required fields (pattern: "${exportDomain.pattern || 'missing'}")` };
      }
      if (exportDomain.mode !== 'light' && exportDomain.mode !== 'dark') {
        return { success: false, error: `Invalid domain "${exportDomain.pattern}": mode must be "light" or "dark"` };
      }

      // Convert group names to IDs
      const groupIds: string[] = [];
      for (const groupName of exportDomain.groups) {
        const groupId = nameToId.get(groupName);
        if (!groupId) {
          return { success: false, error: `Domain "${exportDomain.pattern}" references unknown group: "${groupName}"` };
        }
        groupIds.push(groupId);
      }

      domains.push({
        id: crypto.randomUUID(),
        pattern: exportDomain.pattern,
        mode: exportDomain.mode,
        groupIds,
      });
    }

    // If validation passes, save the data
    await saveGroups(groups);
    await saveDomains(domains);

    return { success: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON/JSON5 format: ' + error.message };
    }
    return { success: false, error: String(error) };
  }
}
