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
let currentDomainConfig: Domain | null = null;

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

// Find domain configuration for current domain
function findDomainConfig(): Domain | null {
  if (!currentDomain) return null;

  return domains.find(d => {
    if (d.matchMode === 'exact') {
      return d.domain === currentDomain;
    } else if (d.matchMode === 'all-subdomains') {
      return currentDomain === d.domain || currentDomain.endsWith('.' + d.domain);
    } else { // domain-and-www
      return currentDomain === d.domain || currentDomain === 'www.' + d.domain;
    }
  }) || null;
}

// Load all data
async function loadData() {
  currentDomain = await getCurrentTabDomain();

  const data = await browserAPI.storage.local.get(['enabled', 'groups', 'domains']);
  const enabled = data.enabled !== false; // Default to true
  groups = data.groups || [];
  domains = data.domains || [];

  currentDomainConfig = findDomainConfig();

  // Update UI
  updateHeader(enabled);
  updateStats();
  renderDomainConfig();
  updateButtons();
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

// Render domain configuration UI
function renderDomainConfig() {
  const container = document.getElementById('domainConfig')!;
  const section = document.getElementById('domainConfigSection')!;
  container.innerHTML = '';

  if (!currentDomain || !currentDomainConfig) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Mode selection
  const modeSelection = document.createElement('div');
  modeSelection.className = 'mode-selection';

  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Display Mode:';
  modeSelection.appendChild(modeLabel);

  const modeButtons = document.createElement('div');
  modeButtons.className = 'mode-buttons';

  ['light', 'dark'].forEach(mode => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mode';
    radio.value = mode;
    radio.checked = currentDomainConfig!.mode === mode;
    radio.addEventListener('change', handleModeChange);

    const span = document.createElement('span');
    span.textContent = mode === 'light' ? 'Light' : 'Dark';

    label.appendChild(radio);
    label.appendChild(span);
    modeButtons.appendChild(label);
  });

  modeSelection.appendChild(modeButtons);
  container.appendChild(modeSelection);

  // Group selection
  const groupSelection = document.createElement('div');
  groupSelection.className = 'group-selection';

  const title = document.createElement('div');
  title.className = 'group-selection-title';
  title.textContent = 'Which groups are active?';
  groupSelection.appendChild(title);

  const enabledGroups = groups.filter(g => g.enabled);
  const hasGroups = currentDomainConfig.groups && currentDomainConfig.groups.length > 0;
  const groupMode = hasGroups ? (currentDomainConfig.groupMode || 'only') : 'all';

  // Option 1: All enabled groups
  const allRadioGroup = document.createElement('div');
  allRadioGroup.className = 'radio-group';
  const allLabel = document.createElement('label');
  const allRadio = document.createElement('input');
  allRadio.type = 'radio';
  allRadio.name = 'grouping';
  allRadio.value = 'all';
  allRadio.checked = groupMode === 'all';
  allRadio.addEventListener('change', handleGroupingChange);
  allLabel.appendChild(allRadio);
  allLabel.appendChild(document.createTextNode(' All enabled groups'));
  allRadioGroup.appendChild(allLabel);
  groupSelection.appendChild(allRadioGroup);

  // Option 2: Only these groups
  const onlyRadioGroup = document.createElement('div');
  onlyRadioGroup.className = 'radio-group';
  const onlyLabel = document.createElement('label');
  const onlyRadio = document.createElement('input');
  onlyRadio.type = 'radio';
  onlyRadio.name = 'grouping';
  onlyRadio.value = 'only';
  onlyRadio.checked = hasGroups && groupMode === 'only';
  onlyRadio.addEventListener('change', handleGroupingChange);
  onlyLabel.appendChild(onlyRadio);
  onlyLabel.appendChild(document.createTextNode(' Only these groups:'));
  onlyRadioGroup.appendChild(onlyLabel);

  const onlyCheckboxList = document.createElement('div');
  onlyCheckboxList.className = 'checkbox-list' + (hasGroups && groupMode === 'only' ? ' visible' : '');
  onlyCheckboxList.id = 'only-list';

  enabledGroups.forEach(g => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = g.name;
    checkbox.className = 'only-checkbox';
    checkbox.checked = hasGroups && groupMode === 'only' && currentDomainConfig!.groups!.includes(g.name);
    checkbox.addEventListener('change', handleGroupCheckboxChange);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + g.name));
    onlyCheckboxList.appendChild(label);
  });

  onlyRadioGroup.appendChild(onlyCheckboxList);
  groupSelection.appendChild(onlyRadioGroup);

  // Option 3: All except these groups
  const exceptRadioGroup = document.createElement('div');
  exceptRadioGroup.className = 'radio-group';
  const exceptLabel = document.createElement('label');
  const exceptRadio = document.createElement('input');
  exceptRadio.type = 'radio';
  exceptRadio.name = 'grouping';
  exceptRadio.value = 'except';
  exceptRadio.checked = hasGroups && groupMode === 'except';
  exceptRadio.addEventListener('change', handleGroupingChange);
  exceptLabel.appendChild(exceptRadio);
  exceptLabel.appendChild(document.createTextNode(' All except these groups:'));
  exceptRadioGroup.appendChild(exceptLabel);

  const exceptCheckboxList = document.createElement('div');
  exceptCheckboxList.className = 'checkbox-list' + (hasGroups && groupMode === 'except' ? ' visible' : '');
  exceptCheckboxList.id = 'except-list';

  enabledGroups.forEach(g => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = g.name;
    checkbox.className = 'except-checkbox';
    checkbox.checked = hasGroups && groupMode === 'except' && currentDomainConfig!.groups!.includes(g.name);
    checkbox.addEventListener('change', handleGroupCheckboxChange);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + g.name));
    exceptCheckboxList.appendChild(label);
  });

  exceptRadioGroup.appendChild(exceptCheckboxList);
  groupSelection.appendChild(exceptRadioGroup);

  container.appendChild(groupSelection);
}

// Handle mode change
async function handleModeChange(e: Event) {
  const radio = e.target as HTMLInputElement;
  if (!currentDomainConfig) return;

  currentDomainConfig.mode = radio.value as 'light' | 'dark';
  await saveDomainConfig();
}

// Handle grouping mode change
function handleGroupingChange() {
  const onlyList = document.getElementById('only-list')!;
  const exceptList = document.getElementById('except-list')!;

  const selectedRadio = document.querySelector('input[name="grouping"]:checked') as HTMLInputElement;
  const value = selectedRadio?.value;

  onlyList.classList.toggle('visible', value === 'only');
  exceptList.classList.toggle('visible', value === 'except');

  // Save the change
  handleGroupCheckboxChange();
}

// Handle group checkbox change
async function handleGroupCheckboxChange() {
  if (!currentDomainConfig) return;

  const selectedRadio = document.querySelector('input[name="grouping"]:checked') as HTMLInputElement;
  const groupingMode = selectedRadio?.value || 'all';

  if (groupingMode === 'all') {
    // Clear groups config - use all enabled groups
    delete currentDomainConfig.groups;
    delete currentDomainConfig.groupMode;
  } else if (groupingMode === 'only') {
    // Get checked groups from only list
    const onlyCheckboxes = document.querySelectorAll('.only-checkbox:checked') as NodeListOf<HTMLInputElement>;
    const selectedGroups = Array.from(onlyCheckboxes).map(cb => cb.value);

    // Always set groups and groupMode for 'only', even if empty
    // Empty array means "only these groups: none" = no highlights
    currentDomainConfig.groups = selectedGroups;
    currentDomainConfig.groupMode = 'only';
  } else if (groupingMode === 'except') {
    // Get checked groups from except list
    const exceptCheckboxes = document.querySelectorAll('.except-checkbox:checked') as NodeListOf<HTMLInputElement>;
    const selectedGroups = Array.from(exceptCheckboxes).map(cb => cb.value);

    if (selectedGroups.length > 0) {
      // Exclude these specific groups
      currentDomainConfig.groups = selectedGroups;
      currentDomainConfig.groupMode = 'except';
    } else {
      // Empty except list means "exclude nothing" = use all groups
      delete currentDomainConfig.groups;
      delete currentDomainConfig.groupMode;
    }
  }

  await saveDomainConfig();
}

// Save domain configuration
async function saveDomainConfig() {
  if (!currentDomainConfig) return;

  const domainIndex = domains.findIndex(d => d.id === currentDomainConfig!.id);
  if (domainIndex !== -1) {
    domains[domainIndex] = currentDomainConfig;
    await browserAPI.storage.local.set({ domains });
    // No need to reload - content script listens for storage changes
  }
}

// Update buttons based on domain state
function updateButtons() {
  const addButton = document.getElementById('addDomain') as HTMLButtonElement;
  const removeButton = document.getElementById('removeDomain') as HTMLButtonElement;

  if (!currentDomain) {
    addButton.disabled = true;
    addButton.textContent = '+ Add This Domain';
    removeButton.style.display = 'none';
    return;
  }

  if (currentDomainConfig) {
    addButton.style.display = 'none';
    removeButton.style.display = 'block';
    removeButton.textContent = `Remove ${currentDomain}`;
  } else {
    addButton.style.display = 'block';
    addButton.textContent = `+ Add ${currentDomain}`;
    addButton.disabled = false;
    removeButton.style.display = 'none';
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
  // No need to reload - content script listens for storage changes
});

// Event: Add This Domain button
document.getElementById('addDomain')!.addEventListener('click', async () => {
  if (!currentDomain) return;

  // Add new domain with default settings
  const newDomain: Domain = {
    id: crypto.randomUUID(),
    domain: currentDomain,
    matchMode: 'domain-and-www',
    mode: 'light'
  };

  domains.push(newDomain);
  currentDomainConfig = newDomain;
  await browserAPI.storage.local.set({ domains });

  // Update UI
  updateStats();
  renderDomainConfig();
  updateButtons();
  // No need to reload - content script listens for storage changes
});

// Event: Remove This Domain button
document.getElementById('removeDomain')!.addEventListener('click', async () => {
  if (!currentDomainConfig) return;

  const confirmed = confirm(`Remove ${currentDomain} from configured domains?`);
  if (!confirmed) return;

  domains = domains.filter(d => d.id !== currentDomainConfig!.id);
  currentDomainConfig = null;
  await browserAPI.storage.local.set({ domains });

  // Update UI
  updateStats();
  renderDomainConfig();
  updateButtons();
  // No need to reload - content script listens for storage changes
});

// Event: Open Settings button
document.getElementById('openSettings')!.addEventListener('click', () => {
  browserAPI.runtime.openOptionsPage();
  window.close();
});

// Initialize
loadData();
