/**
 * Browser permissions utilities
 */

import type { Domain } from '../types';
import { browserAPI } from '../types';

export function domainToHostPatterns(domainConfig: Domain): string[] {
  const { domain, matchMode } = domainConfig;
  const patterns: string[] = [];

  switch (matchMode) {
    case 'domain-and-www':
      patterns.push(`*://${domain}/*`);
      patterns.push(`*://www.${domain}/*`);
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

export async function requestDomainPermissions(domainConfig: Domain): Promise<boolean> {
  try {
    const origins = domainToHostPatterns(domainConfig);
    console.log('[MakeItPop] Requesting permissions for:', origins);

    // Check if we already have permission
    const hasPermission = await browserAPI.permissions.contains({ origins });
    console.log('[MakeItPop] Already has permission:', hasPermission);
    if (hasPermission) {
      return true;
    }

    // Request permission from user
    console.log('[MakeItPop] Prompting user for permission...');
    const granted = await browserAPI.permissions.request({ origins });
    console.log('[MakeItPop] Permission granted:', granted);
    return granted;
  } catch (error) {
    console.error('[MakeItPop] Error requesting permissions:', error);
    return false;
  }
}

export async function requestAllSitesPermission(): Promise<boolean> {
  try {
    console.log('[MakeItPop] Requesting permission for all sites...');
    const granted = await browserAPI.permissions.request({
      origins: ['<all_urls>']
    });
    console.log('[MakeItPop] All sites permission granted:', granted);
    return granted;
  } catch (error) {
    console.error('[MakeItPop] Error requesting all sites permission:', error);
    return false;
  }
}

export async function updatePermissionStatus() {
  const statusText = document.getElementById('permissionStatusText');
  const grantButton = document.getElementById('grantAllSitesPermission') as HTMLButtonElement;

  if (!statusText || !grantButton) return;

  try {
    const hasAllSitesPermission = await browserAPI.permissions.contains({
      origins: ['<all_urls>']
    });

    if (hasAllSitesPermission) {
      statusText.textContent = '✅ All sites permission granted';
      statusText.style.color = 'var(--success-color, green)';
      grantButton.disabled = true;
      grantButton.textContent = '✅ All Sites Permission Granted';
    } else {
      statusText.textContent = '⚠️ Using per-domain permissions (more secure)';
      statusText.style.color = 'var(--warning-color, orange)';
      grantButton.disabled = false;
      grantButton.textContent = '🔓 Grant Permission for All Sites';
    }
  } catch (error) {
    console.error('[MakeItPop] Error checking permissions:', error);
    statusText.textContent = '❌ Error checking permissions';
    statusText.style.color = 'var(--danger-color, red)';
  }
}
