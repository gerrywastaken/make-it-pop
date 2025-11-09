const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

interface Group {
  id: string;
  name: string;
  enabled: boolean;
  lightBgColor: string;
  lightTextColor: string;
  darkBgColor: string;
  darkTextColor: string;
  phrases: string[];
}

interface Domain {
  id: string;
  domain: string;
  matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';
  mode: 'light' | 'dark';
  groups?: string[];
  groupMode?: 'only' | 'except';
}

let currentDomain: string = '';
let groups: Group[] = [];
let domains: Domain[] = [];

// Get current tab's domain
async function getCurrentTabDomain(): Promise<string> {
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url) {
    try {
      const url = new URL(tabs[0].url);
      return url.hostname;
    } catch {
      return '';
    }
  }
  return '';
}

// Load all data
async function loadData() {
  currentDomain = await getCurrentTabDomain();

  const data = await browserAPI.storage.local.get(['enabled', 'groups', 'domains']);
  const enabled = data.enabled !== false; // Default to true
  groups = data.groups || [];
  domains = data.domains || [];

  // Update UI
  updateHeader(enabled);
  updateStats();
  renderGroupToggles();
  updateAddDomainButton();
}

// Update header with current domain
function updateHeader(enabled: boolean) {
  const statusIndicator = document.getElementById('statusIndicator')!;
  const currentDomainEl = document.getElementById('currentDomain')!;
  const enableToggle = document.getElementById('enableToggle') as HTMLInputElement;

  enableToggle.checked = enabled;

  if (currentDomain) {
    currentDomainEl.textContent = currentDomain;
    statusIndicator.className = enabled ? 'status-indicator active' : 'status-indicator inactive';
  } else {
    currentDomainEl.textContent = 'No active tab';
    statusIndicator.className = 'status-indicator inactive';
  }
}

// Update stats
function updateStats() {
  const activeGroupsCount = groups.filter(g => g.enabled).length;
  const domainsCount = domains.length;

  document.getElementById('activeGroupsCount')!.textContent = String(activeGroupsCount);
  document.getElementById('domainsCount')!.textContent = String(domainsCount);
}

// Get groups active for current domain
function getGroupsForCurrentDomain(): { group: Group; isActive: boolean }[] {
  if (!currentDomain) return [];

  // Find domain configuration for current domain
  const domainConfig = domains.find(d => {
    if (d.matchMode === 'exact') {
      return d.domain === currentDomain;
    } else if (d.matchMode === 'all-subdomains') {
      return currentDomain === d.domain || currentDomain.endsWith('.' + d.domain);
    } else { // domain-and-www
      return currentDomain === d.domain || currentDomain === 'www.' + d.domain;
    }
  });

  if (!domainConfig) {
    // Domain not configured - no groups apply
    return [];
  }

  // Get enabled groups
  const enabledGroups = groups.filter(g => g.enabled);

  // Apply domain's group filtering
  let activeGroups: Group[];
  if (!domainConfig.groups || domainConfig.groups.length === 0) {
    // Use all enabled groups
    activeGroups = enabledGroups;
  } else if (domainConfig.groupMode === 'only') {
    // Only specified groups
    activeGroups = enabledGroups.filter(g => domainConfig.groups!.includes(g.name));
  } else {
    // All except specified groups
    activeGroups = enabledGroups.filter(g => !domainConfig.groups!.includes(g.name));
  }

  // Return all enabled groups with active status
  return enabledGroups.map(g => ({
    group: g,
    isActive: activeGroups.some(ag => ag.id === g.id)
  }));
}

// Render group toggles for current domain
function renderGroupToggles() {
  const container = document.getElementById('groupToggles')!;
  const section = document.getElementById('groupTogglesSection')!;
  container.innerHTML = '';

  if (!currentDomain) {
    section.style.display = 'none';
    return;
  }

  // Find domain configuration
  const domainConfig = domains.find(d => {
    if (d.matchMode === 'exact') {
      return d.domain === currentDomain;
    } else if (d.matchMode === 'all-subdomains') {
      return currentDomain === d.domain || currentDomain.endsWith('.' + d.domain);
    } else { // domain-and-www
      return currentDomain === d.domain || currentDomain === 'www.' + d.domain;
    }
  });

  if (!domainConfig) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const groupsForDomain = getGroupsForCurrentDomain();

  if (groupsForDomain.length === 0) {
    container.innerHTML = '<div class="empty-state">No groups enabled</div>';
    return;
  }

  groupsForDomain.forEach(({ group, isActive }) => {
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    if (!isActive) {
      toggleContainer.classList.add('disabled');
    }

    // Label with color badge
    const label = document.createElement('span');
    label.className = 'toggle-label';

    const badge = document.createElement('span');
    badge.className = 'group-badge';
    badge.style.backgroundColor = group.lightBgColor;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = group.name;

    label.appendChild(badge);
    label.appendChild(nameSpan);

    // Toggle switch
    const switchLabel = document.createElement('label');
    switchLabel.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = isActive;
    input.dataset.groupName = group.name;

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    switchLabel.appendChild(input);
    switchLabel.appendChild(slider);

    toggleContainer.appendChild(label);
    toggleContainer.appendChild(switchLabel);
    container.appendChild(toggleContainer);

    // Event listener for toggle - updates domain config
    input.addEventListener('change', async () => {
      if (!domainConfig) return;

      const groupName = group.name;
      let newGroups = domainConfig.groups ? [...domainConfig.groups] : [];
      const currentMode = domainConfig.groupMode || 'only';

      if (currentMode === 'only') {
        // In "only" mode - add/remove from the list
        if (input.checked) {
          if (!newGroups.includes(groupName)) {
            newGroups.push(groupName);
          }
        } else {
          newGroups = newGroups.filter(n => n !== groupName);
        }
      } else {
        // In "except" mode - remove/add from exceptions
        if (input.checked) {
          newGroups = newGroups.filter(n => n !== groupName);
        } else {
          if (!newGroups.includes(groupName)) {
            newGroups.push(groupName);
          }
        }
      }

      // Update domain config
      const domainIndex = domains.findIndex(d => d.id === domainConfig.id);
      if (domainIndex !== -1) {
        if (newGroups.length === 0) {
          // No specific groups - use all
          delete domains[domainIndex].groups;
          delete domains[domainIndex].groupMode;
        } else {
          domains[domainIndex].groups = newGroups;
          domains[domainIndex].groupMode = currentMode;
        }
        await browserAPI.storage.local.set({ domains });

        // Update UI
        toggleContainer.classList.toggle('disabled', !input.checked);

        // Reload current tab
        reloadCurrentTab();
      }
    });
  });
}

// Update "Add This Domain" button
function updateAddDomainButton() {
  const addButton = document.getElementById('addDomain') as HTMLButtonElement;

  if (!currentDomain) {
    addButton.disabled = true;
    addButton.textContent = '+ Add This Domain';
    return;
  }

  // Check if domain already exists
  const domainExists = domains.some(d => d.domain === currentDomain);

  if (domainExists) {
    addButton.textContent = '✓ Domain Already Added';
    addButton.disabled = true;
  } else {
    addButton.textContent = `+ Add ${currentDomain}`;
    addButton.disabled = false;
  }
}

// Reload current tab
async function reloadCurrentTab() {
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browserAPI.tabs.reload(tabs[0].id);
  }
}

// Event: Main extension toggle
document.getElementById('enableToggle')!.addEventListener('change', async (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  await browserAPI.storage.local.set({ enabled });
  updateHeader(enabled);
  reloadCurrentTab();
});

// Event: Add This Domain button
document.getElementById('addDomain')!.addEventListener('click', async () => {
  if (!currentDomain || domains.some(d => d.domain === currentDomain)) {
    return;
  }

  // Add new domain with default settings
  const newDomain: Domain = {
    id: crypto.randomUUID(),
    domain: currentDomain,
    matchMode: 'domain-and-www',
    mode: 'light'
  };

  domains.push(newDomain);
  await browserAPI.storage.local.set({ domains });

  // Update UI
  updateStats();
  updateAddDomainButton();

  // Open settings page to configure the new domain
  browserAPI.runtime.openOptionsPage();
  window.close();
});

// Event: Open Settings button
document.getElementById('openSettings')!.addEventListener('click', () => {
  browserAPI.runtime.openOptionsPage();
  window.close();
});

// Initialize
loadData();
