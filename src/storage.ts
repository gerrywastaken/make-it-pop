import type { Group, Domain, StorageData } from './types';

// Browser polyfill for Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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

export async function exportData(): Promise<string> {
  const groups = await getGroups();
  const domains = await getDomains();
  const data: StorageData = { groups, domains };
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonString) as StorageData;

    // Validate the structure
    if (!data.groups || !Array.isArray(data.groups)) {
      return { success: false, error: 'Invalid format: missing or invalid "groups" array' };
    }
    if (!data.domains || !Array.isArray(data.domains)) {
      return { success: false, error: 'Invalid format: missing or invalid "domains" array' };
    }

    // Validate each group
    for (const group of data.groups) {
      if (!group.id || !group.name || !group.phrases || !Array.isArray(group.phrases)) {
        return { success: false, error: 'Invalid group format: missing required fields' };
      }
      if (!group.lightBgColor || !group.lightTextColor || !group.darkBgColor || !group.darkTextColor) {
        return { success: false, error: 'Invalid group format: missing color fields' };
      }
    }

    // Validate each domain
    for (const domain of data.domains) {
      if (!domain.id || !domain.pattern || !domain.mode || !domain.groupIds || !Array.isArray(domain.groupIds)) {
        return { success: false, error: 'Invalid domain format: missing required fields' };
      }
      if (domain.mode !== 'light' && domain.mode !== 'dark') {
        return { success: false, error: 'Invalid domain mode: must be "light" or "dark"' };
      }
    }

    // If validation passes, save the data
    await saveGroups(data.groups);
    await saveDomains(data.domains);

    return { success: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' };
    }
    return { success: false, error: String(error) };
  }
}
