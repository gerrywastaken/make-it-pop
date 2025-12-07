/**
 * Storage utilities for groups and domains
 */

import type { Group, Domain } from '../types';
import { browserAPI } from '../types';

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
 * Updates all domain references when a group is renamed
 * @param oldName - The previous group name
 * @param newName - The new group name
 * @param deps - Optional dependency overrides for testing
 * @returns true if any domains were updated, false otherwise
 * @throws Error if storage operations fail
 */
export async function updateDomainReferencesAfterGroupRename(
  oldName: string,
  newName: string,
  deps?: {
    getDomains?: typeof getDomains;
    saveDomains?: typeof saveDomains;
  }
): Promise<boolean> {
  const _getDomains = deps?.getDomains ?? getDomains;
  const _saveDomains = deps?.saveDomains ?? saveDomains;

  const domains = await _getDomains();
  let domainsUpdated = false;

  for (const domain of domains) {
    if (domain.groups?.includes(oldName)) {
      domain.groups = domain.groups.map(groupName =>
        groupName === oldName ? newName : groupName
      );
      domainsUpdated = true;
    }
  }

  if (domainsUpdated) {
    await _saveDomains(domains);
  }

  return domainsUpdated;
}
