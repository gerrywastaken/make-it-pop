import JSON5 from 'json5';
import { BUILD_VERSION_NAME, BUILD_COMMIT, BUILD_TIME } from '../version';

// Inline types
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
  domain: string;  // Just the domain without wildcards (e.g., "linkedin.com")
  matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';  // How to match the domain
  mode: 'light' | 'dark';
  groups?: string[];  // List of group names (optional, omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Defaults to 'only' if groups specified
}

// Export format types (user-friendly, no IDs)
interface ExportGroup {
  name: string;
  enabled?: boolean;  // Optional for backwards compatibility, defaults to true
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
  phrases: string[];
}

interface ExportDomain {
  domain: string;
  matchMode?: 'domain-and-www' | 'all-subdomains' | 'exact';  // Optional: defaults to 'domain-and-www'
  mode: 'light' | 'dark';
  groups?: string[];  // Optional: group names (omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Optional: defaults to 'only' if groups specified
}

interface ExportData {
  groups: ExportGroup[];
  domains: ExportDomain[];
}

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// DOM helper functions to safely create elements without innerHTML
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    textContent?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration>;
    attributes?: Record<string, string>;
    children?: (HTMLElement | Text)[];
  }
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options?.textContent) element.textContent = options.textContent;
  if (options?.className) element.className = options.className;
  if (options?.style) Object.assign(element.style, options.style);
  if (options?.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  if (options?.children) {
    options.children.forEach(child => element.appendChild(child));
  }
  return element;
}

function createText(text: string): Text {
  return document.createTextNode(text);
}

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

async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
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

    // If validation passes, save the data
    groups = newGroups;
    domains = newDomains;
    await saveGroups(groups);
    await saveDomains(domains);

    return { success: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON/JSON5 format: ' + error.message };
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
  render();
  displayVersionInfo();
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
  renderGroups();
  renderDomains();
  renderDomainGroupsSelection();
}

function renderGroups() {
  const list = document.getElementById('groupsList')!;
  // Clear existing content
  list.textContent = '';

  groups.forEach(g => {
    const container = createElement('div', {
      style: !g.enabled ? { opacity: '0.5' } : {}
    });

    // Create checkbox and label
    const label = createElement('label');
    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        'data-id': g.id,
        ...(g.enabled ? { checked: '' } : {})
      },
      className: 'toggle-group-enabled'
    });
    const nameStrong = createElement('strong', { textContent: g.name });
    const disabledText = !g.enabled ? createText(' (disabled)') : null;

    label.appendChild(checkbox);
    label.appendChild(createText(' '));
    label.appendChild(nameStrong);
    if (disabledText) label.appendChild(disabledText);
    container.appendChild(label);
    container.appendChild(createElement('br'));

    // Light mode sample
    container.appendChild(createText('Light: '));
    container.appendChild(createElement('span', {
      textContent: 'Sample',
      style: {
        background: g.lightBgColor,
        color: g.lightTextColor,
        padding: '2px 8px'
      }
    }));
    container.appendChild(createText(' '));

    // Dark mode sample
    container.appendChild(createText('Dark: '));
    container.appendChild(createElement('span', {
      textContent: 'Sample',
      style: {
        background: g.darkBgColor,
        color: g.darkTextColor,
        padding: '2px 8px'
      }
    }));
    container.appendChild(createText(' '));

    // Edit button
    container.appendChild(createElement('button', {
      textContent: 'Edit',
      className: 'edit-group',
      attributes: { 'data-id': g.id }
    }));
    container.appendChild(createText(' '));

    // Delete button
    container.appendChild(createElement('button', {
      textContent: 'Delete',
      className: 'delete-group',
      attributes: { 'data-id': g.id }
    }));

    // Phrases
    const phrasesDiv = createElement('div');
    phrasesDiv.appendChild(createText('Phrases: '));
    phrasesDiv.appendChild(createText(g.phrases.join(', ')));
    container.appendChild(phrasesDiv);

    list.appendChild(container);
  });

  // Update button text and show/hide cancel
  const btn = document.getElementById('addGroup') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelGroup') as HTMLButtonElement;
  btn.textContent = editingGroupId ? 'Update Group' : 'Add Group';
  cancelBtn.style.display = editingGroupId ? 'inline-block' : 'none';
}

function renderDomains() {
  const list = document.getElementById('domainsList')!;
  // Clear existing content
  list.textContent = '';

  domains.forEach(d => {
    const container = createElement('div');

    // Domain (strong)
    container.appendChild(createElement('strong', { textContent: d.domain }));
    container.appendChild(createText(' ['));

    // Match mode display
    const matchModeDisplay = d.matchMode === 'domain-and-www' ? 'Domain + www' :
                             d.matchMode === 'all-subdomains' ? 'All subdomains' :
                             'Exact';
    container.appendChild(createText(matchModeDisplay));
    container.appendChild(createText('] ('));
    container.appendChild(createText(d.mode));
    container.appendChild(createText(' mode) - '));

    // Show groups display based on new schema
    let groupsDisplay;
    if (!d.groups || d.groups.length === 0) {
      groupsDisplay = 'All enabled groups';
    } else {
      const groupMode = d.groupMode || 'only';
      const groupsList = d.groups.join(', ');
      if (groupMode === 'only') {
        groupsDisplay = `Only: ${groupsList}`;
      } else {
        groupsDisplay = `All except: ${groupsList}`;
      }
    }
    container.appendChild(createText(groupsDisplay));
    container.appendChild(createText(' '));

    // Edit button
    container.appendChild(createElement('button', {
      textContent: 'Edit',
      className: 'edit-domain',
      attributes: { 'data-id': d.id }
    }));
    container.appendChild(createText(' '));

    // Delete button
    container.appendChild(createElement('button', {
      textContent: 'Delete',
      className: 'delete-domain',
      attributes: { 'data-id': d.id }
    }));

    list.appendChild(container);
  });

  // Update button text and show/hide cancel
  const btn = document.getElementById('addDomain') as HTMLButtonElement;
  const cancelBtn = document.getElementById('cancelDomain') as HTMLButtonElement;
  btn.textContent = editingDomainId ? 'Update Domain' : 'Add Domain';
  cancelBtn.style.display = editingDomainId ? 'inline-block' : 'none';
}

function renderDomainGroupsSelection() {
  const container = document.getElementById('domainGroupsSelection')!;
  const editingDomain = editingDomainId ? domains.find(d => d.id === editingDomainId) : null;

  // Determine group mode and selected groups
  const hasGroups = editingDomain && editingDomain.groups && editingDomain.groups.length > 0;
  const groupMode = hasGroups ? (editingDomain!.groupMode || 'only') : 'only';
  const useAllGroups = !hasGroups;

  // Clear existing content
  container.textContent = '';

  // Title
  container.appendChild(createElement('strong', { textContent: 'Groups:' }));
  container.appendChild(createElement('br'));

  // Radio: Use all enabled groups
  const allLabel = createElement('label');
  const allRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: 'domainGroupsMode',
      value: 'all',
      ...(useAllGroups ? { checked: '' } : {})
    }
  });
  allLabel.appendChild(allRadio);
  allLabel.appendChild(createText(' Use all enabled groups'));
  container.appendChild(allLabel);
  container.appendChild(createElement('br'));

  // Radio: Use only these groups
  const onlyLabel = createElement('label');
  const onlyRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: 'domainGroupsMode',
      value: 'only',
      ...(hasGroups && groupMode === 'only' ? { checked: '' } : {})
    }
  });
  onlyLabel.appendChild(onlyRadio);
  onlyLabel.appendChild(createText(' Use only these groups:'));
  container.appendChild(onlyLabel);
  container.appendChild(createElement('br'));

  // Only groups list
  const onlyGroupsList = createElement('div', {
    attributes: { id: 'onlyGroupsList' },
    style: {
      marginLeft: '20px',
      display: hasGroups && groupMode === 'only' ? 'block' : 'none'
    }
  });
  groups.forEach(g => {
    const isChecked = editingDomain && editingDomain.groups && editingDomain.groups.includes(g.name) && groupMode === 'only';
    const label = createElement('label');
    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        value: g.name,
        ...(isChecked ? { checked: '' } : {})
      },
      className: 'only-group-checkbox'
    });
    label.appendChild(checkbox);
    label.appendChild(createText(' ' + g.name));
    onlyGroupsList.appendChild(label);
    onlyGroupsList.appendChild(createElement('br'));
  });
  container.appendChild(onlyGroupsList);

  // Radio: Use all except these groups
  const exceptLabel = createElement('label');
  const exceptRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: 'domainGroupsMode',
      value: 'except',
      ...(hasGroups && groupMode === 'except' ? { checked: '' } : {})
    }
  });
  exceptLabel.appendChild(exceptRadio);
  exceptLabel.appendChild(createText(' Use all except these groups:'));
  container.appendChild(exceptLabel);
  container.appendChild(createElement('br'));

  // Except groups list
  const exceptGroupsList = createElement('div', {
    attributes: { id: 'exceptGroupsList' },
    style: {
      marginLeft: '20px',
      display: hasGroups && groupMode === 'except' ? 'block' : 'none'
    }
  });
  groups.forEach(g => {
    const isChecked = editingDomain && editingDomain.groups && editingDomain.groups.includes(g.name) && groupMode === 'except';
    const label = createElement('label');
    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        value: g.name,
        ...(isChecked ? { checked: '' } : {})
      },
      className: 'except-group-checkbox'
    });
    label.appendChild(checkbox);
    label.appendChild(createText(' ' + g.name));
    exceptGroupsList.appendChild(label);
    exceptGroupsList.appendChild(createElement('br'));
  });
  container.appendChild(exceptGroupsList);

  // Add event listeners to show/hide group lists based on selected mode
  const radios = container.querySelectorAll<HTMLInputElement>('input[name="domainGroupsMode"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const onlyList = document.getElementById('onlyGroupsList')!;
      const exceptList = document.getElementById('exceptGroupsList')!;

      if (radio.value === 'all') {
        onlyList.style.display = 'none';
        exceptList.style.display = 'none';
      } else if (radio.value === 'only') {
        onlyList.style.display = 'block';
        exceptList.style.display = 'none';
      } else if (radio.value === 'except') {
        onlyList.style.display = 'none';
        exceptList.style.display = 'block';
      }
    });
  });
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
    // Update existing group (preserve enabled state)
    const index = groups.findIndex(g => g.id === editingGroupId);
    if (index !== -1) {
      groups[index] = {
        id: editingGroupId,
        name,
        enabled: groups[index].enabled,  // Preserve enabled state
        lightBgColor,
        lightTextColor,
        darkBgColor,
        darkTextColor,
        phrases,
      };
    }
    editingGroupId = null;
  } else {
    // Add new group (enabled by default)
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      enabled: true,  // New groups are enabled by default
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

  const matchModeRadio = document.querySelector<HTMLInputElement>('input[name="domainMatchMode"]:checked');
  const matchMode = (matchModeRadio?.value || 'domain-and-www') as 'domain-and-www' | 'all-subdomains' | 'exact';

  const modeRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"]:checked');
  const mode = (modeRadio?.value || 'light') as 'light' | 'dark';

  // Determine group selection mode
  const groupsModeRadio = document.querySelector<HTMLInputElement>('input[name="domainGroupsMode"]:checked');
  const groupsMode = groupsModeRadio?.value || 'all';

  const newDomain: Domain = {
    id: editingDomainId || crypto.randomUUID(),
    domain: pattern,
    matchMode,
    mode,
  };

  // Set groups and groupMode based on selection
  if (groupsMode === 'only') {
    const onlyCheckboxes = document.querySelectorAll<HTMLInputElement>('.only-group-checkbox:checked');
    const selectedGroups = Array.from(onlyCheckboxes).map(cb => cb.value);
    if (selectedGroups.length > 0) {
      newDomain.groups = selectedGroups;
      newDomain.groupMode = 'only';
    }
  } else if (groupsMode === 'except') {
    const exceptCheckboxes = document.querySelectorAll<HTMLInputElement>('.except-group-checkbox:checked');
    const selectedGroups = Array.from(exceptCheckboxes).map(cb => cb.value);
    if (selectedGroups.length > 0) {
      newDomain.groups = selectedGroups;
      newDomain.groupMode = 'except';
    }
  }
  // If groupsMode === 'all', don't set groups or groupMode (defaults to all enabled groups)

  if (editingDomainId) {
    // Update existing domain
    const index = domains.findIndex(d => d.id === editingDomainId);
    if (index !== -1) {
      domains[index] = newDomain;
    }
    editingDomainId = null;
  } else {
    // Add new domain
    domains.push(newDomain);
  }

  await saveDomains(domains);

  patternInput.value = '';
  // Reset match mode to domain-and-www
  const defaultMatchModeRadio = document.querySelector<HTMLInputElement>('input[name="domainMatchMode"][value="domain-and-www"]');
  if (defaultMatchModeRadio) defaultMatchModeRadio.checked = true;
  // Reset mode to light
  const lightRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"][value="light"]');
  if (lightRadio) lightRadio.checked = true;
  render();
});

// Event delegation for group buttons and checkboxes
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
    render();
  } else if (target.classList.contains('edit-group')) {
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
    patternInput.value = domain.domain;

    // Set the match mode radio button
    const matchModeRadio = document.querySelector<HTMLInputElement>(`input[name="domainMatchMode"][value="${domain.matchMode}"]`);
    if (matchModeRadio) matchModeRadio.checked = true;

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

  // Reset match mode to domain-and-www
  const defaultMatchModeRadio = document.querySelector<HTMLInputElement>('input[name="domainMatchMode"][value="domain-and-www"]');
  if (defaultMatchModeRadio) defaultMatchModeRadio.checked = true;

  // Reset mode to light
  const lightRadio = document.querySelector<HTMLInputElement>('input[name="domainMode"][value="light"]');
  if (lightRadio) lightRadio.checked = true;

  // render() will reset the group selection UI to default state
  render();
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

init();
