// Inline types
interface Group {
  id: string;
  name: string;
  lightBgColor: string;
  lightTextColor: string;
  darkBgColor: string;
  darkTextColor: string;
  phrases: string[];
}

interface Domain {
  id: string;
  pattern: string;
  mode: 'light' | 'dark';
  groupIds: string[];
}

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Inline storage functions
async function getGroups(): Promise<Group[]> {
  const data = await browserAPI.storage.local.get('groups');
  return data.groups || [];
}

async function saveGroups(groups: Group[]): Promise<void> {
  await browserAPI.storage.local.set({ groups });
}

async function getDomains(): Promise<Domain[]> {
  const data = await browserAPI.storage.local.get('domains');
  return data.domains || [];
}

async function saveDomains(domains: Domain[]): Promise<void> {
  await browserAPI.storage.local.set({ domains });
}

async function exportData(): Promise<string> {
  const data = { groups, domains };
  return JSON.stringify(data, null, 2);
}

async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonString) as { groups: Group[]; domains: Domain[] };

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
    groups = data.groups;
    domains = data.domains;
    await saveGroups(groups);
    await saveDomains(domains);

    return { success: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON format' };
    }
    return { success: false, error: String(error) };
  }
}

let groups: Group[] = [];
let domains: Domain[] = [];
let editingGroupId: string | null = null;
let editingDomainId: string | null = null;

// Migrate old data format to new format
async function migrateData() {
  const rawData = await browserAPI.storage.local.get(['groups', 'domains']);
  let needsSave = false;

  // Migrate groups from old format (single 'color' field) to new format
  if (rawData.groups && rawData.groups.length > 0) {
    const migratedGroups = rawData.groups.map((g: any) => {
      // Check if this is old format (has 'color' but not 'lightBgColor')
      if (g.color && !g.lightBgColor) {
        needsSave = true;
        return {
          id: g.id,
          name: g.name,
          lightBgColor: g.color,
          lightTextColor: '#000000',
          darkBgColor: g.color,
          darkTextColor: '#ffffff',
          phrases: g.phrases,
        };
      }
      return g; // Already new format
    });

    if (needsSave) {
      await saveGroups(migratedGroups);
    }
  }

  // Migrate domains from old format (no 'mode' field) to new format
  if (rawData.domains && rawData.domains.length > 0) {
    let domainNeedsSave = false;
    const migratedDomains = rawData.domains.map((d: any) => {
      // Check if this is old format (no 'mode' field)
      if (!d.mode) {
        domainNeedsSave = true;
        return {
          id: d.id,
          pattern: d.pattern,
          mode: 'light' as const,
          groupIds: d.groupIds,
        };
      }
      return d; // Already new format
    });

    if (domainNeedsSave) {
      await saveDomains(migratedDomains);
    }
  }
}

async function init() {
  await migrateData(); // Run migration first
  groups = await getGroups();
  domains = await getDomains();
  render();
}

function render() {
  renderGroups();
  renderDomains();
  renderDomainGroupsSelection();
}

function renderGroups() {
  const list = document.getElementById('groupsList')!;
  list.innerHTML = groups.map(g => `
    <div>
      <strong>${g.name}</strong><br>
      Light: <span style="background: ${g.lightBgColor}; color: ${g.lightTextColor}; padding: 2px 8px;">Sample</span>
      Dark: <span style="background: ${g.darkBgColor}; color: ${g.darkTextColor}; padding: 2px 8px;">Sample</span>
      <button class="edit-group" data-id="${g.id}">Edit</button>
      <button class="delete-group" data-id="${g.id}">Delete</button>
      <div>Phrases: ${g.phrases.join(', ')}</div>
    </div>
  `).join('');

  // Update button text and show/hide cancel
  const btn = document.getElementById('addGroup') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelGroup') as HTMLButtonElement;
  btn.textContent = editingGroupId ? 'Update Group' : 'Add Group';
  cancelBtn.style.display = editingGroupId ? 'inline-block' : 'none';
}

function renderDomains() {
  const list = document.getElementById('domainsList')!;
  list.innerHTML = domains.map(d => {
    // Show "All groups" if all groups are assigned, otherwise list them
    let groupsDisplay;
    if (d.groupIds.length === groups.length && groups.length > 0) {
      groupsDisplay = 'All groups';
    } else {
      const groupNames = d.groupIds
        .map(id => groups.find(g => g.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      groupsDisplay = groupNames || 'No groups';
    }

    return `
      <div>
        <strong>${d.pattern}</strong> (${d.mode} mode) - ${groupsDisplay}
        <button class="edit-domain" data-id="${d.id}">Edit</button>
        <button class="delete-domain" data-id="${d.id}">Delete</button>
      </div>
    `;
  }).join('');

  // Update button text and show/hide cancel
  const btn = document.getElementById('addDomain') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelDomain') as HTMLButtonElement;
  btn.textContent = editingDomainId ? 'Update Domain' : 'Add Domain';
  cancelBtn.style.display = editingDomainId ? 'inline-block' : 'none';
}

function renderDomainGroupsSelection() {
  const container = document.getElementById('domainGroupsSelection')!;
  const editingDomain = editingDomainId ? domains.find(d => d.id === editingDomainId) : null;
  container.innerHTML = groups.map(g => {
    // Check all by default when adding new, otherwise check only assigned groups when editing
    const isChecked = editingDomain
      ? (editingDomain.groupIds.includes(g.id) ? 'checked' : '')
      : 'checked';
    return `
      <label>
        <input type="checkbox" value="${g.id}" class="domain-group-checkbox" ${isChecked}>
        ${g.name}
      </label>
    `;
  }).join('<br>');
}

document.getElementById('addGroup')!.addEventListener('click', async () => {
  const nameInput = document.getElementById('groupName') as HTMLInputElement;
  const lightBgInput = document.getElementById('groupLightBg') as HTMLInputElement;
  const lightTextInput = document.getElementById('groupLightText') as HTMLInputElement;
  const darkBgInput = document.getElementById('groupDarkBg') as HTMLInputElement;
  const darkTextInput = document.getElementById('groupDarkText') as HTMLInputElement;
  const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

  const name = nameInput.value.trim();
  const lightBgColor = lightBgInput.value;
  const lightTextColor = lightTextInput.value;
  const darkBgColor = darkBgInput.value;
  const darkTextColor = darkTextInput.value;
  const phrases = phrasesInput.value.split('\n').map(p => p.trim()).filter(Boolean);

  if (!name || phrases.length === 0) return;

  if (editingGroupId) {
    // Update existing group
    const index = groups.findIndex(g => g.id === editingGroupId);
    if (index !== -1) {
      groups[index] = {
        id: editingGroupId,
        name,
        lightBgColor,
        lightTextColor,
        darkBgColor,
        darkTextColor,
        phrases,
      };
    }
    editingGroupId = null;
  } else {
    // Add new group
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      lightBgColor,
      lightTextColor,
      darkBgColor,
      darkTextColor,
      phrases,
    };
    groups.push(newGroup);
  }

  await saveGroups(groups);

  nameInput.value = '';
  lightBgInput.value = '#ffff00';
  lightTextInput.value = '#000000';
  darkBgInput.value = '#3a3a00';
  darkTextInput.value = '#ffffff';
  phrasesInput.value = '';
  render();
});

document.getElementById('addDomain')!.addEventListener('click', async () => {
  const patternInput = document.getElementById('domainPattern') as HTMLInputElement;
  const pattern = patternInput.value.trim();

  if (!pattern) return;

  const modeRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"]:checked');
  const mode = (modeRadio?.value || 'light') as 'light' | 'dark';

  const checkboxes = document.querySelectorAll<HTMLInputElement>('.domain-group-checkbox:checked');
  const groupIds = Array.from(checkboxes).map(cb => cb.value);

  if (editingDomainId) {
    // Update existing domain
    const index = domains.findIndex(d => d.id === editingDomainId);
    if (index !== -1) {
      domains[index] = {
        id: editingDomainId,
        pattern,
        mode,
        groupIds,
      };
    }
    editingDomainId = null;
  } else {
    // Add new domain
    const newDomain: Domain = {
      id: crypto.randomUUID(),
      pattern,
      mode,
      groupIds,
    };
    domains.push(newDomain);
  }

  await saveDomains(domains);

  patternInput.value = '';
  // Reset mode to light
  const lightRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"][value="light"]');
  if (lightRadio) lightRadio.checked = true;
  checkboxes.forEach(cb => cb.checked = false);
  render();
});

// Event delegation for group buttons
document.getElementById('groupsList')!.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('edit-group')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    const group = groups.find(g => g.id === id);
    if (!group) return;

    editingGroupId = id;

    const nameInput = document.getElementById('groupName') as HTMLInputElement;
    const lightBgInput = document.getElementById('groupLightBg') as HTMLInputElement;
    const lightTextInput = document.getElementById('groupLightText') as HTMLInputElement;
    const darkBgInput = document.getElementById('groupDarkBg') as HTMLInputElement;
    const darkTextInput = document.getElementById('groupDarkText') as HTMLInputElement;
    const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

    nameInput.value = group.name;
    lightBgInput.value = group.lightBgColor;
    lightTextInput.value = group.lightTextColor;
    darkBgInput.value = group.darkBgColor;
    darkTextInput.value = group.darkTextColor;
    phrasesInput.value = group.phrases.join('\n');

    render();
  } else if (target.classList.contains('delete-group')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    groups = groups.filter(g => g.id !== id);
    await saveGroups(groups);
    render();
  }
});

// Event delegation for domain buttons
document.getElementById('domainsList')!.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('edit-domain')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    const domain = domains.find(d => d.id === id);
    if (!domain) return;

    editingDomainId = id;

    const patternInput = document.getElementById('domainPattern') as HTMLInputElement;
    patternInput.value = domain.pattern;

    // Set the mode radio button
    const modeRadio = document.querySelector<HTMLInputElement>(`input[name="domainMode"][value="${domain.mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    render();
  } else if (target.classList.contains('delete-domain')) {
    const id = target.getAttribute('data-id');
    if (!id) return;

    domains = domains.filter(d => d.id !== id);
    await saveDomains(domains);
    render();
  }
});

document.getElementById('cancelGroup')!.addEventListener('click', () => {
  editingGroupId = null;

  const nameInput = document.getElementById('groupName') as HTMLInputElement;
  const lightBgInput = document.getElementById('groupLightBg') as HTMLInputElement;
  const lightTextInput = document.getElementById('groupLightText') as HTMLInputElement;
  const darkBgInput = document.getElementById('groupDarkBg') as HTMLInputElement;
  const darkTextInput = document.getElementById('groupDarkText') as HTMLInputElement;
  const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

  nameInput.value = '';
  lightBgInput.value = '#ffff00';
  lightTextInput.value = '#000000';
  darkBgInput.value = '#3a3a00';
  darkTextInput.value = '#ffffff';
  phrasesInput.value = '';

  render();
});

document.getElementById('cancelDomain')!.addEventListener('click', () => {
  editingDomainId = null;

  const patternInput = document.getElementById('domainPattern') as HTMLInputElement;
  patternInput.value = '';

  // Reset mode to light
  const lightRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"][value="light"]');
  if (lightRadio) lightRadio.checked = true;

  const checkboxes = document.querySelectorAll<HTMLInputElement>('.domain-group-checkbox:checked');
  checkboxes.forEach(cb => cb.checked = false);

  render();
});

// Export data handler
document.getElementById('exportData')!.addEventListener('click', async () => {
  const jsonData = await exportData();
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  a.download = `makeitpop-config-${date}.json`;
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

init();
