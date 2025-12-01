/**
 * Import/Export utilities for groups and domains
 */

import JSON5 from 'json5';
import type { Group, Domain, ExportGroup, ExportDomain, ExportData } from '../types';
import { saveGroups, saveDomains } from './storage';

export async function exportData(groups: Group[], domains: Domain[]): Promise<string> {
  // Convert to export format (no IDs, name-based references)
  const exportGroups: ExportGroup[] = groups.map(g => {
    const group: ExportGroup = {
      name: g.name,
      lightBg: g.lightBgColor,
      lightText: g.lightTextColor,
      darkBg: g.darkBgColor,
      darkText: g.darkTextColor,
      phrases: g.phrases,
    };
    // Only include enabled field if it's false (true is default, no need to clutter config)
    if (!g.enabled) {
      group.enabled = false;
    }
    return group;
  });

  const exportDomains: ExportDomain[] = domains.map(d => {
    const domain: ExportDomain = {
      domain: d.domain,
      mode: d.mode,
    };
    // Only include matchMode if it's not the default ('domain-and-www')
    if (d.matchMode && d.matchMode !== 'domain-and-www') {
      domain.matchMode = d.matchMode;
    }
    // Only include groups/groupMode if they're specified (omit for "all groups")
    if (d.groups && d.groups.length > 0) {
      domain.groups = d.groups;
      // Only include groupMode if it's not the default ('only')
      if (d.groupMode && d.groupMode !== 'only') {
        domain.groupMode = d.groupMode;
      }
    }
    return domain;
  });

  const data: ExportData = { groups: exportGroups, domains: exportDomains };

  // Use JSON5 stringify for cleaner output (no quotes on keys)
  return JSON5.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; groups?: Group[]; domains?: Domain[]; error?: string }> {
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
    const newGroups: Group[] = [];

    for (const exportGroup of data.groups) {
      // Validate group
      if (!exportGroup.name || !exportGroup.phrases || !Array.isArray(exportGroup.phrases)) {
        return { success: false, error: `Invalid group format: missing required fields (name: "${exportGroup.name || 'missing'}")` };
      }
      if (!exportGroup.lightBg || !exportGroup.lightText || !exportGroup.darkBg || !exportGroup.darkText) {
        return { success: false, error: `Invalid group "${exportGroup.name}": missing color fields` };
      }

      const id = crypto.randomUUID();

      newGroups.push({
        id,
        name: exportGroup.name,
        enabled: exportGroup.enabled !== false,  // Default to true if not specified
        lightBgColor: exportGroup.lightBg,
        lightTextColor: exportGroup.lightText,
        darkBgColor: exportGroup.darkBg,
        darkTextColor: exportGroup.darkText,
        phrases: exportGroup.phrases,
      });
    }

    // Convert domains to internal format
    const newDomains: Domain[] = [];

    for (const exportDomain of data.domains) {
      // Handle backward compatibility: accept old 'pattern' field
      const domainField = exportDomain.domain || (exportDomain as any).pattern;

      // Validate domain
      if (!domainField || !exportDomain.mode) {
        return { success: false, error: `Invalid domain format: missing required fields (domain: "${domainField || 'missing'}")` };
      }
      if (exportDomain.mode !== 'light' && exportDomain.mode !== 'dark') {
        return { success: false, error: `Invalid domain "${domainField}": mode must be "light" or "dark"` };
      }

      // Validate matchMode if specified
      if (exportDomain.matchMode &&
          exportDomain.matchMode !== 'domain-and-www' &&
          exportDomain.matchMode !== 'all-subdomains' &&
          exportDomain.matchMode !== 'exact') {
        return { success: false, error: `Invalid domain "${domainField}": matchMode must be "domain-and-www", "all-subdomains", or "exact"` };
      }

      // Validate groupMode if specified
      if (exportDomain.groupMode && exportDomain.groupMode !== 'only' && exportDomain.groupMode !== 'except') {
        return { success: false, error: `Invalid domain "${domainField}": groupMode must be "only" or "except"` };
      }

      // Validate group references if specified
      if (exportDomain.groups && exportDomain.groups.length > 0) {
        for (const groupName of exportDomain.groups) {
          const groupExists = newGroups.some(g => g.name === groupName);
          if (!groupExists) {
            return { success: false, error: `Domain "${domainField}" references unknown group: "${groupName}"` };
          }
        }
      }

      // Convert old 'pattern' format to new 'domain' + 'matchMode' if needed
      let domain: string;
      let matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';

      if (exportDomain.domain) {
        // New format
        domain = exportDomain.domain;
        matchMode = exportDomain.matchMode || 'domain-and-www';
      } else {
        // Old format: convert pattern to domain + matchMode
        const pattern = (exportDomain as any).pattern;
        if (pattern.startsWith('*.')) {
          domain = pattern.slice(2);
          matchMode = 'all-subdomains';
        } else {
          domain = pattern;
          matchMode = 'domain-and-www';
        }
      }

      const newDomain: Domain = {
        id: crypto.randomUUID(),
        domain,
        matchMode,
        mode: exportDomain.mode,
      };

      // Only include groups/groupMode if specified
      if (exportDomain.groups && exportDomain.groups.length > 0) {
        newDomain.groups = exportDomain.groups;
        newDomain.groupMode = exportDomain.groupMode || 'only';  // Default to 'only'
      }

      newDomains.push(newDomain);
    }

    // Save the data
    await saveGroups(newGroups);
    await saveDomains(newDomains);

    return { success: true, groups: newGroups, domains: newDomains };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON/JSON5 format: ' + error.message };
    }
    return { success: false, error: String(error) };
  }
}
