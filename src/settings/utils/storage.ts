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
