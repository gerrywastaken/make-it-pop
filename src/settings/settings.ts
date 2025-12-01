import JSON5 from 'json5';
import { BUILD_VERSION_NAME, BUILD_COMMIT, BUILD_TIME } from '../version';
import type { Group, Domain } from './types';
import { browserAPI } from './types';
import { createElement, showToast } from './utils/dom';
import { getGroups, saveGroups, getDomains, saveDomains } from './utils/storage';
import { exportData, importData } from './utils/importExport';
import { requestAllSitesPermission, updatePermissionStatus } from './utils/permissions';
import { createGroupCard, initGroupCard, updateGroupsState } from './components/groupCard';
import { createDomainCard, initDomainCard, updateDomainsState, updateGroupsReference } from './components/domainCard';

let groups: Group[] = [];
let domains: Domain[] = [];

async function migrateData() {
  const rawData = await browserAPI.storage.local.get(['groups', 'domains']);
  let groupsNeedsSave = false;
  let domainsNeedsSave = false;

  // Migrate groups from old format to new format
  if (rawData.groups && rawData.groups.length > 0) {
    const migratedGroups = rawData.groups.map((g: any) => {
      let needsMigration = false;
      const migrated: any = { ...g };

      // Old format: single 'color' field -> migrate to lightBgColor/darkBgColor
      if (g.color && !g.lightBgColor) {
        needsMigration = true;
        migrated.lightBgColor = g.color;
        migrated.lightTextColor = '#000000';
        migrated.darkBgColor = g.color;
        migrated.darkTextColor = '#ffffff';
        delete migrated.color;
      }

      // Add 'enabled' field if missing (default to true)
      if (g.enabled === undefined) {
        needsMigration = true;
        migrated.enabled = true;
      }

      if (needsMigration) {
        groupsNeedsSave = true;
      }
      return migrated;
    });

    if (groupsNeedsSave) {
      await saveGroups(migratedGroups);
    }
  }

  // Migrate domains from old format to new format
  if (rawData.domains && rawData.domains.length > 0) {
    const allGroups = await getGroups();
    const idToName = new Map(allGroups.map((g: any) => [g.id, g.name]));

    const migratedDomains = rawData.domains.map((d: any) => {
      let needsMigration = false;
      const migrated: any = { ...d };

      // Old format: 'pattern' field -> migrate to 'domain' + 'matchMode'
      if (d.pattern && !d.domain) {
        needsMigration = true;
        if (d.pattern.startsWith('*.')) {
          // Old wildcard pattern -> all-subdomains mode
          migrated.domain = d.pattern.slice(2);  // Remove '*.'
          migrated.matchMode = 'all-subdomains';
        } else {
          // Old plain domain -> domain-and-www mode (new default)
          migrated.domain = d.pattern;
          migrated.matchMode = 'domain-and-www';
        }
        delete migrated.pattern;
      }

      // Add matchMode if missing (new field, default to 'domain-and-www')
      if (!d.matchMode && d.domain) {
        needsMigration = true;
        migrated.matchMode = 'domain-and-www';
      }

      // Old format: no 'mode' field -> default to 'light'
      if (!d.mode) {
        needsMigration = true;
        migrated.mode = 'light';
      }

      // Old format: 'groupIds' array -> migrate to 'groups' (names) + 'groupMode'
      if (d.groupIds && Array.isArray(d.groupIds)) {
        needsMigration = true;
        // Convert IDs to names
        const groupNames = d.groupIds
          .map((id: string) => idToName.get(id))
          .filter(Boolean);

        // Only set groups if not all groups (let it default to "all enabled groups")
        if (groupNames.length > 0 && groupNames.length < allGroups.length) {
          migrated.groups = groupNames;
          // Don't set groupMode, it will default to 'only'
        }
        // If all groups or no groups, don't set the groups field (use default "all enabled")

        delete migrated.groupIds;
      }

      if (needsMigration) {
        domainsNeedsSave = true;
      }
      return migrated;
    });

    if (domainsNeedsSave) {
      await saveDomains(migratedDomains);
    }
  }
}

async function init() {
  await migrateData(); // Run migration first
  groups = await getGroups();
  domains = await getDomains();

  // Initialize components with state and render function
  initGroupCard(groups, render);
  initDomainCard(domains, groups, render);

  render();
  displayVersionInfo();
  setupTabSwitching();
  updatePermissionStatus();
}

// Check and display current permission status
async function updatePermissionStatus() {
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

// Request permission for all sites
async function requestAllSitesPermission(): Promise<boolean> {
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

// Tab switching logic
function setupTabSwitching() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      if (!tabId) return;

      // Update buttons
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      // Update content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const tabContent = document.getElementById(tabId);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    });
  });
}

// Toast notification helper
function showToast(message: string, type: 'success' | 'warning' = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function displayVersionInfo() {
  // Display build-time version (includes commit hash)
  const buildVersionEl = document.getElementById('buildVersion')!;
  buildVersionEl.textContent = BUILD_VERSION_NAME;
  buildVersionEl.title = `Built at: ${BUILD_TIME}\nCommit: ${BUILD_COMMIT}`;

  // Display runtime version from manifest (just semantic version)
  const manifest = browserAPI.runtime.getManifest();
  const runtimeVersionEl = document.getElementById('runtimeVersion')!;
  const runtimeVersion = manifest.version;
  runtimeVersionEl.textContent = runtimeVersion;

  // Check for mismatch: compare base version numbers only
  // Build version is like "1.0.0-5f9c794", runtime is like "1.0.0"
  const versionWarning = document.getElementById('versionWarning')!;
  const buildBaseVersion = BUILD_VERSION_NAME.split('-')[0]; // Extract "1.0.0" from "1.0.0-5f9c794"

  if (buildBaseVersion !== runtimeVersion) {
    versionWarning.style.display = 'block';
  } else {
    versionWarning.style.display = 'none';
  }
}

function render() {
  // Update component state before rendering
  updateGroupsState(groups);
  updateDomainsState(domains);
  updateGroupsReference(groups);

  renderGroups();
  renderDomains();
}

function renderGroups() {
  const list = document.getElementById('groupsList')!;
  const emptyState = document.getElementById('groupsEmptyState')!;

  list.textContent = '';

  if (groups.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    groups.forEach(g => {
      const card = createGroupCard(g);
      list.appendChild(card);
    });
  }
}


function renderDomains() {
  const list = document.getElementById('domainsList')!;
  const emptyState = document.getElementById('domainsEmptyState')!;

  list.textContent = '';

  if (domains.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    domains.forEach(d => {
      const card = createDomainCard(d);
      list.appendChild(card);
    });
  }
}

document.getElementById('groupsList')!.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('toggle-group-enabled')) {
    // Handle enabled checkbox toggle
    const checkbox = target as HTMLInputElement;
    const id = checkbox.getAttribute('data-id');
    if (!id) return;

    const group = groups.find(g => g.id === id);
    if (!group) return;

    group.enabled = checkbox.checked;
    await saveGroups(groups);
    showToast(`Group ${checkbox.checked ? 'enabled' : 'disabled'}`);
    render();
  } else if (target.classList.contains('edit-group')) {
    // Toggle to edit mode
    const id = target.getAttribute('data-id');
    if (!id) return;

    const card = document.querySelector(`.card[data-id="${id}"]`) as HTMLElement;
    if (card) {
      card.classList.remove('viewing');
      card.classList.add('editing');
    }
  } else if (target.classList.contains('delete-group')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    const group = groups.find(g => g.id === id);
    if (!group) return;

    if (confirm(`Delete group "${group.name}"?`)) {
      groups = groups.filter(g => g.id !== id);
      await saveGroups(groups);
      showToast('Group deleted');
      render();
    }
  }
});

// Event delegation for domains list
document.getElementById('domainsList')!.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('request-permission')) {
    // Request permission for this domain
    // IMPORTANT: Cannot use async/await - Firefox requires direct call from user action
    const id = target.getAttribute('data-id');
    if (!id) return;

    const domain = domains.find(d => d.id === id);
    if (!domain) return;

    const origins = domainToHostPatterns(domain);
    console.log('[MakeItPop] Requesting permissions for:', origins);

    // Call permissions.request() directly without async/await
    browserAPI.permissions.request({ origins }).then(granted => {
      console.log('[MakeItPop] Permission granted:', granted);
      if (granted) {
        showToast(`Permission granted for ${domain.domain}!`);
      } else {
        showToast(`Permission denied for ${domain.domain}`, 'warning');
      }
    }).catch(error => {
      console.error('[MakeItPop] Error requesting permission:', error);
      showToast(`Error requesting permission: ${error.message}`, 'warning');
    });
  } else if (target.classList.contains('edit-domain')) {
    // Toggle to edit mode
    const id = target.getAttribute('data-id');
    if (!id) return;

    const card = document.querySelector(`.card[data-id="${id}"]`) as HTMLElement;
    if (card) {
      card.classList.remove('viewing');
      card.classList.add('editing');
    }
  } else if (target.classList.contains('delete-domain')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    const domain = domains.find(d => d.id === id);
    if (!domain) return;

    if (confirm(`Delete domain "${domain.domain}"?`)) {
      domains = domains.filter(d => d.id !== id);
      await saveDomains(domains);
      showToast('Domain deleted');
      render();
    }
  }
});

// Add Group button handler
document.getElementById('addGroup')?.addEventListener('click', () => {
  const newGroup: Group = {
    id: '', // Will be set in save
    name: '',
    enabled: true,
    lightBgColor: '#ffff00',
    lightTextColor: '#000000',
    darkBgColor: '#3a3a00',
    darkTextColor: '#ffffff',
    phrases: []
  };

  const card = createGroupCard(newGroup);
  card.setAttribute('data-id', ''); // No ID yet
  card.classList.remove('viewing');
  card.classList.add('editing');

  const list = document.getElementById('groupsList')!;
  list.insertBefore(card, list.firstChild);
});

// Add Domain button handler
document.getElementById('addDomain')?.addEventListener('click', () => {
  const newDomain: Domain = {
    id: '', // Will be set in save
    domain: '',
    matchMode: 'domain-and-www',
    mode: 'light'
  };

  const card = createDomainCard(newDomain);
  card.setAttribute('data-id', ''); // No ID yet
  card.classList.remove('viewing');
  card.classList.add('editing');

  const list = document.getElementById('domainsList')!;
  list.insertBefore(card, list.firstChild);
});

// Export data handler
document.getElementById('exportData')!.addEventListener('click', async () => {
  const jsonData = await exportData();
  const blob = new Blob([jsonData], { type: 'application/json5' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  a.download = `makeitpop-config-${date}.json5`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Import data handler
document.getElementById('importData')!.addEventListener('click', () => {
  const fileInput = document.getElementById('importFile') as HTMLInputElement;
  fileInput.click();
});

document.getElementById('importFile')!.addEventListener('change', async (e) => {
  const fileInput = e.target as HTMLInputElement;
  const statusDiv = document.getElementById('importStatus')!;

  if (!fileInput.files || fileInput.files.length === 0) {
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (event) => {
    const content = event.target?.result as string;
    const result = await importData(content);

    if (result.success) {
      statusDiv.textContent = 'Configuration imported successfully!';
      statusDiv.style.color = 'green';
      render(); // Re-render to show imported data
    } else {
      statusDiv.textContent = `Import failed: ${result.error}`;
      statusDiv.style.color = 'red';
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 5000);
  };

  reader.onerror = () => {
    statusDiv.textContent = 'Error reading file';
    statusDiv.style.color = 'red';
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 5000);
  };

  reader.readAsText(file);

  // Reset file input so the same file can be selected again
  fileInput.value = '';
});

// Grant All Sites Permission handler
// IMPORTANT: Cannot use async/await here - Firefox requires direct call from user action
document.getElementById('grantAllSitesPermission')?.addEventListener('click', () => {
  console.log('[MakeItPop] Grant all sites button clicked');

  // Call permissions.request() directly without async/await to avoid promise chain
  browserAPI.permissions.request({
    origins: ['<all_urls>']
  }).then(granted => {
    console.log('[MakeItPop] All sites permission result:', granted);
    if (granted) {
      showToast('Permission granted for all sites! The extension will now work on all configured domains.');
      updatePermissionStatus();
    } else {
      showToast('Permission denied. You can still grant permissions per-domain using the 🔓 buttons.', 'warning');
    }
  }).catch(error => {
    console.error('[MakeItPop] Error requesting all sites permission:', error);
    showToast('Error requesting permission: ' + error.message, 'warning');
  });
});

// Load Sample Data handler
document.getElementById('loadSampleData')?.addEventListener('click', async () => {
  // Create sample groups
  const sampleGroups: Group[] = [
    {
      id: crypto.randomUUID(),
      name: 'Key Terms',
      enabled: true,
      lightBgColor: '#ffff00',
      lightTextColor: '#000000',
      darkBgColor: '#e5a50a',
      darkTextColor: '#000000',
      phrases: ['code review', 'pull request', 'merge conflict', 'technical debt']
    },
    {
      id: crypto.randomUUID(),
      name: 'Important Actions',
      enabled: true,
      lightBgColor: '#f66151',
      lightTextColor: '#000000',
      darkBgColor: '#a51d2d',
      darkTextColor: '#ffffff',
      phrases: ['needs attention', 'breaking change', 'security issue', 'critical bug']
    },
    {
      id: crypto.randomUUID(),
      name: 'Positive Indicators',
      enabled: true,
      lightBgColor: '#51cf66',
      lightTextColor: '#000000',
      darkBgColor: '#1e4620',
      darkTextColor: '#ffffff',
      phrases: ['approved', 'looks good', 'well done', 'great work']
    }
  ];

  // Create sample domains
  const sampleDomains: Domain[] = [
    {
      id: crypto.randomUUID(),
      domain: 'github.com',
      matchMode: 'domain-and-www',
      mode: 'light'
    }
  ];

  // Save sample data
  groups = sampleGroups;
  domains = sampleDomains;
  await saveGroups(groups);
  await saveDomains(domains);

  showToast('Sample data loaded! Visit github.com to see it in action.');
  render();
});

init();
