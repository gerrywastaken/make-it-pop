/**
 * Storage utilities for groups and domains
 *
 * Re-exports from centralized browserApi module and adds settings-specific utilities.
 */

// Re-export core storage functions from centralized module
export { getGroups, saveGroups, getDomains, saveDomains } from '../../browserApi';

// Import for use in this module
import { getDomains, saveDomains } from '../../browserApi';

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
