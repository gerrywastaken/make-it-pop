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

// Convert domain config to host patterns for permissions
function domainToHostPatterns(domainConfig: Domain): string[] {
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

// Request permissions for a domain
async function requestDomainPermissions(domainConfig: Domain): Promise<boolean> {
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
  renderGroups();
  renderDomains();
}

function renderGroups() {
  const list = document.getElementById('groupsList')!;
  const emptyState = document.getElementById('groupsEmptyState')!;

  // Clear existing content
  list.textContent = '';

  // Show or hide empty state
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

function createGroupCard(g: Group): HTMLElement {
  // Create card container
  const card = createElement('div', {
    className: `card ${g.id ? 'viewing' : 'editing'}${!g.enabled ? ' disabled' : ''}`,
    attributes: { 'data-id': g.id || '' }
  });

  // Card header with toggle and title
  const header = createElement('div', { className: 'card-header' });

  // Toggle switch
  const toggleLabel = createElement('label', { className: 'toggle-switch' });
  const toggleInput = createElement('input', {
    attributes: {
      type: 'checkbox',
      'data-id': g.id,
      ...(g.enabled ? { checked: '' } : {})
    },
    className: 'toggle-group-enabled'
  });
  const toggleSlider = createElement('span', { className: 'toggle-slider' });
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);

  // Group name
  const groupName = createElement('div', { className: 'group-name' });
  const nameInput = createElement('input', {
    attributes: {
      type: 'text',
      value: g.name,
      placeholder: 'Group name'
    }
  });
  nameInput.disabled = true;
  groupName.appendChild(nameInput);

  // Action buttons (edit only in view mode)
  const actions = createElement('div', { className: 'card-actions' });
  const editBtn = createElement('button', {
    textContent: '✏️',
    className: 'btn-icon',
    attributes: { title: 'Edit' }
  });
  editBtn.addEventListener('click', () => editGroup(card));
  actions.appendChild(editBtn);

  header.appendChild(toggleLabel);
  header.appendChild(groupName);
  header.appendChild(actions);
  card.appendChild(header);

  // Color preview section with mode toggle
  const colorPreviewSection = createElement('div', { className: 'color-preview-section' });

  // Mode toggle bar
  const modeToggleBar = createElement('div', { className: 'mode-toggle-bar' });
  modeToggleBar.appendChild(createElement('span', {
    className: 'preview-label',
    textContent: 'Highlight Preview'
  }));

  const modeToggle = createElement('div', { className: 'mode-toggle' });
  const lightBtn = createElement('button', {
    textContent: '☀️ Light',
    className: 'mode-toggle-btn'
  });
  const darkBtn = createElement('button', {
    textContent: '🌙 Dark',
    className: 'mode-toggle-btn active'
  });

  lightBtn.addEventListener('click', () => switchPreviewMode(card, 'light', lightBtn, darkBtn));
  darkBtn.addEventListener('click', () => switchPreviewMode(card, 'dark', lightBtn, darkBtn));

  modeToggle.appendChild(lightBtn);
  modeToggle.appendChild(darkBtn);
  modeToggleBar.appendChild(modeToggle);
  colorPreviewSection.appendChild(modeToggleBar);

  // Light mode preview
  const lightModePreview = createElement('div', {
    className: 'mode-preview light-mode',
    attributes: { 'data-mode': 'light' }
  });

  const lightPreview = createElement('div', { className: 'highlight-preview' });
  lightPreview.appendChild(createText('Click here to customize colors. This is how '));
  lightPreview.appendChild(createElement('span', {
    className: 'highlight-sample',
    textContent: 'highlighted text',
    style: { background: g.lightBgColor, color: g.lightTextColor }
  }));
  lightPreview.appendChild(createText(' will appear on light backgrounds.'));
  lightPreview.addEventListener('click', () => toggleColorEdit(lightPreview));
  lightModePreview.appendChild(lightPreview);

  // Light mode color inputs
  const lightColorInputs = createElement('div', { className: 'color-inputs' });

  const lightBgGroup = createElement('div', { className: 'color-input-group' });
  lightBgGroup.appendChild(createElement('label', { className: 'color-input-label', textContent: 'Background' }));
  const lightBgWrapper = createElement('div', { className: 'color-input-wrapper' });
  const lightBgColorInput = createElement('input', {
    attributes: { type: 'color', value: g.lightBgColor },
    className: 'edit-group-light-bg-color'
  });
  const lightBgHexInput = createElement('input', {
    attributes: { type: 'text', value: g.lightBgColor },
    className: 'edit-group-light-bg-hex color-hex'
  });
  lightBgWrapper.appendChild(lightBgColorInput);
  lightBgWrapper.appendChild(lightBgHexInput);
  lightBgGroup.appendChild(lightBgWrapper);

  const lightTextGroup = createElement('div', { className: 'color-input-group' });
  lightTextGroup.appendChild(createElement('label', { className: 'color-input-label', textContent: 'Text' }));
  const lightTextWrapper = createElement('div', { className: 'color-input-wrapper' });
  const lightTextColorInput = createElement('input', {
    attributes: { type: 'color', value: g.lightTextColor },
    className: 'edit-group-light-text-color'
  });
  const lightTextHexInput = createElement('input', {
    attributes: { type: 'text', value: g.lightTextColor },
    className: 'edit-group-light-text-hex color-hex'
  });
  lightTextWrapper.appendChild(lightTextColorInput);
  lightTextWrapper.appendChild(lightTextHexInput);
  lightTextGroup.appendChild(lightTextWrapper);

  lightColorInputs.appendChild(lightBgGroup);
  lightColorInputs.appendChild(lightTextGroup);
  lightModePreview.appendChild(lightColorInputs);

  // Sync light mode inputs
  syncColorInputs(lightBgColorInput, lightBgHexInput);
  syncColorInputs(lightTextColorInput, lightTextHexInput);
  lightBgColorInput.addEventListener('input', () => updatePreviewColors(lightPreview, lightBgColorInput.value, lightTextColorInput.value));
  lightTextColorInput.addEventListener('input', () => updatePreviewColors(lightPreview, lightBgColorInput.value, lightTextColorInput.value));

  colorPreviewSection.appendChild(lightModePreview);

  // Dark mode preview
  const darkModePreview = createElement('div', {
    className: 'mode-preview dark-mode active',
    attributes: { 'data-mode': 'dark' }
  });

  const darkPreview = createElement('div', { className: 'highlight-preview' });
  darkPreview.appendChild(createText('Click here to customize colors. This is how '));
  darkPreview.appendChild(createElement('span', {
    className: 'highlight-sample',
    textContent: 'highlighted text',
    style: { background: g.darkBgColor, color: g.darkTextColor }
  }));
  darkPreview.appendChild(createText(' will appear on dark backgrounds.'));
  darkPreview.addEventListener('click', () => toggleColorEdit(darkPreview));
  darkModePreview.appendChild(darkPreview);

  // Dark mode color inputs
  const darkColorInputs = createElement('div', { className: 'color-inputs' });

  const darkBgGroup = createElement('div', { className: 'color-input-group' });
  darkBgGroup.appendChild(createElement('label', { className: 'color-input-label', textContent: 'Background' }));
  const darkBgWrapper = createElement('div', { className: 'color-input-wrapper' });
  const darkBgColorInput = createElement('input', {
    attributes: { type: 'color', value: g.darkBgColor },
    className: 'edit-group-dark-bg-color'
  });
  const darkBgHexInput = createElement('input', {
    attributes: { type: 'text', value: g.darkBgColor },
    className: 'edit-group-dark-bg-hex color-hex'
  });
  darkBgWrapper.appendChild(darkBgColorInput);
  darkBgWrapper.appendChild(darkBgHexInput);
  darkBgGroup.appendChild(darkBgWrapper);

  const darkTextGroup = createElement('div', { className: 'color-input-group' });
  darkTextGroup.appendChild(createElement('label', { className: 'color-input-label', textContent: 'Text' }));
  const darkTextWrapper = createElement('div', { className: 'color-input-wrapper' });
  const darkTextColorInput = createElement('input', {
    attributes: { type: 'color', value: g.darkTextColor },
    className: 'edit-group-dark-text-color'
  });
  const darkTextHexInput = createElement('input', {
    attributes: { type: 'text', value: g.darkTextColor },
    className: 'edit-group-dark-text-hex color-hex'
  });
  darkTextWrapper.appendChild(darkTextColorInput);
  darkTextWrapper.appendChild(darkTextHexInput);
  darkTextGroup.appendChild(darkTextWrapper);

  darkColorInputs.appendChild(darkBgGroup);
  darkColorInputs.appendChild(darkTextGroup);
  darkModePreview.appendChild(darkColorInputs);

  // Sync dark mode inputs
  syncColorInputs(darkBgColorInput, darkBgHexInput);
  syncColorInputs(darkTextColorInput, darkTextHexInput);
  darkBgColorInput.addEventListener('input', () => updatePreviewColors(darkPreview, darkBgColorInput.value, darkTextColorInput.value));
  darkTextColorInput.addEventListener('input', () => updatePreviewColors(darkPreview, darkBgColorInput.value, darkTextColorInput.value));

  colorPreviewSection.appendChild(darkModePreview);
  card.appendChild(colorPreviewSection);

  // Phrases section
  const phrasesSection = createElement('div', { className: 'phrases-section' });
  const phrasesHeader = createElement('div', { className: 'phrases-header' });
  phrasesHeader.appendChild(createElement('span', {
    className: 'phrases-label',
    textContent: 'Phrases to Highlight'
  }));
  phrasesHeader.appendChild(createElement('span', {
    className: 'phrases-count',
    textContent: `${g.phrases.length} phrase${g.phrases.length !== 1 ? 's' : ''}`
  }));
  phrasesSection.appendChild(phrasesHeader);

  // Phrases display with minimal tags
  const phrasesDisplay = createElement('div', { className: 'phrases-display' });
  g.phrases.forEach(phrase => {
    const phraseItem = createElement('span', { className: 'phrase-item' });
    phraseItem.appendChild(createElement('span', { className: 'phrase-text', textContent: phrase }));
    const deleteBtn = createElement('button', {
      textContent: '×',
      className: 'phrase-delete'
    });
    deleteBtn.addEventListener('click', () => {
      phraseItem.remove();
      // Update count
      const count = phrasesDisplay.querySelectorAll('.phrase-item').length;
      const countSpan = phrasesSection.querySelector('.phrases-count') as HTMLElement;
      if (countSpan) {
        countSpan.textContent = `${count} phrase${count !== 1 ? 's' : ''}`;
      }
    });
    phraseItem.appendChild(deleteBtn);
    phrasesDisplay.appendChild(phraseItem);
  });
  phrasesSection.appendChild(phrasesDisplay);

  // Phrase input area
  const phraseInputArea = createElement('div', { className: 'phrase-input-area' });
  const phraseInput = createElement('input', {
    attributes: { type: 'text', placeholder: 'Type a phrase and press Enter or click Add...' }
  });
  const addPhraseBtn = createElement('button', {
    textContent: 'Add',
    className: 'btn btn-secondary'
  });

  const addPhrase = () => {
    const value = phraseInput.value.trim();
    if (value) {
      const phraseItem = createElement('span', { className: 'phrase-item' });
      phraseItem.appendChild(createElement('span', { className: 'phrase-text', textContent: value }));
      const deleteBtn = createElement('button', {
        textContent: '×',
        className: 'phrase-delete'
      });
      deleteBtn.addEventListener('click', () => {
        phraseItem.remove();
        // Update count
        const count = phrasesDisplay.querySelectorAll('.phrase-item').length;
        const countSpan = phrasesSection.querySelector('.phrases-count') as HTMLElement;
        if (countSpan) {
          countSpan.textContent = `${count} phrase${count !== 1 ? 's' : ''}`;
        }
      });
      phraseItem.appendChild(deleteBtn);
      phrasesDisplay.appendChild(phraseItem);
      phraseInput.value = '';

      // Update count
      const count = phrasesDisplay.querySelectorAll('.phrase-item').length;
      const countSpan = phrasesSection.querySelector('.phrases-count') as HTMLElement;
      if (countSpan) {
        countSpan.textContent = `${count} phrase${count !== 1 ? 's' : ''}`;
      }
    }
  };

  addPhraseBtn.addEventListener('click', addPhrase);
  phraseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPhrase();
    }
  });

  phraseInputArea.appendChild(phraseInput);
  phraseInputArea.appendChild(addPhraseBtn);
  phrasesSection.appendChild(phraseInputArea);
  card.appendChild(phrasesSection);

  // Card footer with actions
  const cardFooter = createElement('div', { className: 'card-footer' });
  const deleteBtn = createElement('button', {
    textContent: 'Delete Group',
    className: 'btn btn-danger'
  });
  deleteBtn.addEventListener('click', () => deleteGroup(g.id));

  const footerActions = createElement('div', { className: 'card-footer-actions' });
  const cancelBtn = createElement('button', {
    textContent: 'Cancel',
    className: 'btn btn-secondary cancel-group-btn'
  });
  const saveBtn = createElement('button', {
    textContent: 'Save Changes',
    className: 'btn btn-primary save-group-btn'
  });

  cancelBtn.addEventListener('click', () => cancelGroupEdit(card));
  saveBtn.addEventListener('click', () => saveGroupFromCard(card));

  footerActions.appendChild(cancelBtn);
  footerActions.appendChild(saveBtn);
  cardFooter.appendChild(deleteBtn);
  cardFooter.appendChild(footerActions);
  card.appendChild(cardFooter);

  return card;
}

// Helper functions for the new group card design
function editGroup(card: HTMLElement) {
  card.classList.remove('viewing');
  card.classList.add('editing');
  const nameInput = card.querySelector('.group-name input') as HTMLInputElement;
  if (nameInput) {
    nameInput.disabled = false;
  }
}

async function deleteGroup(id: string) {
  const group = groups.find(g => g.id === id);
  if (!group) return;

  if (confirm(`Delete group "${group.name}"?`)) {
    groups = groups.filter(g => g.id !== id);
    await saveGroups(groups);
    showToast('Group deleted');
    render();
  }
}

function switchPreviewMode(card: HTMLElement, mode: 'light' | 'dark', lightBtn: HTMLElement, darkBtn: HTMLElement) {
  // Update button states
  lightBtn.classList.toggle('active', mode === 'light');
  darkBtn.classList.toggle('active', mode === 'dark');

  // Switch preview visibility
  const previews = card.querySelectorAll('.mode-preview');
  previews.forEach(p => {
    const preview = p as HTMLElement;
    const previewMode = preview.getAttribute('data-mode');
    preview.classList.toggle('active', previewMode === mode);
  });
}

function toggleColorEdit(preview: HTMLElement) {
  preview.classList.toggle('editing');
  const colorInputs = preview.nextElementSibling as HTMLElement;
  if (colorInputs && colorInputs.classList.contains('color-inputs')) {
    colorInputs.classList.toggle('visible');
  }
}

function updatePreviewColors(preview: HTMLElement, bgColor: string, textColor: string) {
  const sample = preview.querySelector('.highlight-sample') as HTMLElement;
  if (sample) {
    sample.style.background = bgColor;
    sample.style.color = textColor;
  }
}


function syncColorInputs(colorInput: HTMLInputElement, hexInput: HTMLInputElement) {
  colorInput.addEventListener('input', () => {
    hexInput.value = colorInput.value;
  });
  hexInput.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
      colorInput.value = hexInput.value;
    }
  });
}

async function saveGroupFromCard(card: HTMLElement) {
  const id = card.getAttribute('data-id');

  const nameInput = card.querySelector('.edit-group-name') as HTMLInputElement;
  const lightBgHex = card.querySelector('.edit-group-light-bg-hex') as HTMLInputElement;
  const lightTextHex = card.querySelector('.edit-group-light-text-hex') as HTMLInputElement;
  const darkBgHex = card.querySelector('.edit-group-dark-bg-hex') as HTMLInputElement;
  const darkTextHex = card.querySelector('.edit-group-dark-text-hex') as HTMLInputElement;

  const name = nameInput.value.trim();

  // Check if we're in raw mode or normal mode
  const rawModeContainer = card.querySelector('.phrase-raw-mode') as HTMLElement;
  const isRawMode = rawModeContainer && rawModeContainer.style.display !== 'none';

  let phrases: string[];
  if (isRawMode) {
    // Collect phrases from textarea (raw mode)
    const rawTextarea = card.querySelector('.phrase-raw-textarea') as HTMLTextAreaElement;
    phrases = rawTextarea.value
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean);
  } else {
    // Collect phrases from tags (normal mode)
    const phraseTags = card.querySelectorAll('.edit-phrase-tags .phrase-tag');
    phrases = Array.from(phraseTags).map(tag => {
      const text = tag.childNodes[0].textContent || '';
      return text.trim();
    }).filter(Boolean);
  }

  if (!name || phrases.length === 0) {
    showToast('Name and at least one phrase are required', 'warning');
    return;
  }

  if (id) {
    // Update existing group
    const index = groups.findIndex(g => g.id === id);
    if (index !== -1) {
      groups[index] = {
        ...groups[index],
        name,
        lightBgColor: lightBgHex.value,
        lightTextColor: lightTextHex.value,
        darkBgColor: darkBgHex.value,
        darkTextColor: darkTextHex.value,
        phrases,
      };
    }
    await saveGroups(groups);
    showToast('Group updated successfully!');
  } else {
    // Add new group
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      lightBgColor: lightBgHex.value,
      lightTextColor: lightTextHex.value,
      darkBgColor: darkBgHex.value,
      darkTextColor: darkTextHex.value,
      phrases,
    };
    groups.push(newGroup);
    await saveGroups(groups);
    showToast('Group added successfully!');
  }

  render();
}

function cancelGroupEdit(card: HTMLElement) {
  const id = card.getAttribute('data-id');
  if (id) {
    // Existing group - switch back to view mode
    card.classList.remove('editing');
    card.classList.add('viewing');
  } else {
    // New group - remove the card
    card.remove();
  }
}

function renderDomains() {
  const list = document.getElementById('domainsList')!;
  const emptyState = document.getElementById('domainsEmptyState')!;

  // Clear existing content
  list.textContent = '';

  // Show or hide empty state
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

function createDomainCard(d: Domain): HTMLElement {
  // Create card container
  const card = createElement('div', {
    className: 'card viewing',
    attributes: { 'data-id': d.id }
  });

  // Card header
  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', {
    className: 'card-title',
    textContent: d.domain
  });

  // Action buttons
  const actions = createElement('div', { className: 'card-actions' });
  actions.appendChild(createElement('button', {
    textContent: '🔓',
    className: 'icon-only request-permission',
    attributes: { 'data-id': d.id, title: 'Request Permission' }
  }));
  actions.appendChild(createElement('button', {
    textContent: '✏️',
    className: 'icon-only edit-domain',
    attributes: { 'data-id': d.id, title: 'Edit' }
  }));
  actions.appendChild(createElement('button', {
    textContent: '🗑️',
    className: 'icon-only danger delete-domain',
    attributes: { 'data-id': d.id, title: 'Delete' }
  }));

  header.appendChild(title);
  header.appendChild(actions);
  card.appendChild(header);

  // View mode content
  const viewMode = createElement('div', { className: 'view-mode' });

  // Match mode display
  const matchModeDisplay = d.matchMode === 'domain-and-www' ? 'Domain + www' :
                           d.matchMode === 'all-subdomains' ? 'All subdomains' :
                           'Exact match';
  const matchInfo = createElement('div', { className: 'domain-info' });
  matchInfo.appendChild(createElement('strong', { textContent: 'Match: ' }));
  matchInfo.appendChild(createText(matchModeDisplay));
  viewMode.appendChild(matchInfo);

  // Display mode (light/dark)
  const modeInfo = createElement('div', { className: 'domain-info' });
  modeInfo.appendChild(createElement('strong', { textContent: 'Mode: ' }));
  modeInfo.appendChild(createText(d.mode === 'light' ? 'Light' : 'Dark'));
  viewMode.appendChild(modeInfo);

  // Groups display
  let groupsDisplay;
  if (!d.groups || d.groups.length === 0) {
    groupsDisplay = 'All enabled groups';
  } else {
    const groupMode = d.groupMode || 'only';
    const groupsList = d.groups.join(', ');
    if (groupMode === 'only') {
      groupsDisplay = `Only "${groupsList}"`;
    } else {
      groupsDisplay = `All except "${groupsList}"`;
    }
  }
  const groupsInfo = createElement('div', { className: 'domain-info' });
  groupsInfo.appendChild(createElement('strong', { textContent: 'Groups: ' }));
  groupsInfo.appendChild(createText(groupsDisplay));
  viewMode.appendChild(groupsInfo);

  card.appendChild(viewMode);

  // Edit mode content
  const editMode = createElement('div', { className: 'edit-mode' });

  // Domain input
  const domainInput = createElement('input', {
    attributes: {
      type: 'text',
      placeholder: 'Domain (e.g., linkedin.com)',
      value: d.domain
    },
    className: 'edit-domain-input'
  });
  editMode.appendChild(domainInput);

  // Match mode selection
  const matchModeContainer = createElement('div', { style: { margin: '15px 0' } });
  matchModeContainer.appendChild(createElement('label', {
    textContent: 'Match:',
    style: { fontWeight: '600', display: 'block', marginBottom: '10px' }
  }));

  const matchModes = [
    { value: 'domain-and-www', label: 'Domain + www' },
    { value: 'all-subdomains', label: 'All subdomains' },
    { value: 'exact', label: 'Exact match' }
  ];

  matchModes.forEach(mode => {
    const label = createElement('label', { style: { marginRight: '15px' } });
    const radio = createElement('input', {
      attributes: {
        type: 'radio',
        name: `match-${d.id}`,
        value: mode.value,
        ...(d.matchMode === mode.value ? { checked: '' } : {})
      },
      className: 'edit-domain-match-mode'
    });
    label.appendChild(radio);
    label.appendChild(createText(' ' + mode.label));
    matchModeContainer.appendChild(label);
  });

  editMode.appendChild(matchModeContainer);

  // Mode selection (light/dark)
  const modeContainer = createElement('div', { style: { margin: '15px 0' } });
  modeContainer.appendChild(createElement('label', {
    textContent: 'Mode:',
    style: { fontWeight: '600', display: 'block', marginBottom: '10px' }
  }));

  const modes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];

  modes.forEach(mode => {
    const label = createElement('label', { style: { marginRight: '20px' } });
    const radio = createElement('input', {
      attributes: {
        type: 'radio',
        name: `mode-${d.id}`,
        value: mode.value,
        ...(d.mode === mode.value ? { checked: '' } : {})
      },
      className: 'edit-domain-mode'
    });
    label.appendChild(radio);
    label.appendChild(createText(' ' + mode.label));
    modeContainer.appendChild(label);
  });

  editMode.appendChild(modeContainer);

  // Group selection
  const groupSelection = createElement('div', { className: 'group-selection' });
  groupSelection.appendChild(createElement('div', {
    className: 'group-selection-title',
    textContent: 'Which groups should be active?'
  }));

  const hasGroups = d.groups && d.groups.length > 0;
  const groupMode = hasGroups ? (d.groupMode || 'only') : 'all';

  // "All enabled groups" option
  const allGroupsLabel = createElement('label', { className: 'radio-group' });
  const allGroupsRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: `grouping-${d.id}`,
      value: 'all',
      ...(groupMode === 'all' ? { checked: '' } : {})
    },
    className: 'edit-domain-grouping'
  });
  allGroupsLabel.appendChild(allGroupsRadio);
  allGroupsLabel.appendChild(createText(' All enabled groups'));
  groupSelection.appendChild(allGroupsLabel);

  // "Only these groups" option
  const onlyGroupsLabel = createElement('label', { className: 'radio-group' });
  const onlyGroupsRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: `grouping-${d.id}`,
      value: 'only',
      ...(hasGroups && groupMode === 'only' ? { checked: '' } : {})
    },
    className: 'edit-domain-grouping'
  });
  onlyGroupsLabel.appendChild(onlyGroupsRadio);
  onlyGroupsLabel.appendChild(createText(' Only these groups:'));
  groupSelection.appendChild(onlyGroupsLabel);

  const onlyGroupsList = createElement('div', {
    className: `checkbox-list${hasGroups && groupMode === 'only' ? ' visible' : ''}`,
    attributes: { 'data-mode': 'only' }
  });

  groups.forEach(g => {
    const label = createElement('label');
    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        value: g.name,
        ...(hasGroups && groupMode === 'only' && d.groups!.includes(g.name) ? { checked: '' } : {})
      },
      className: 'edit-domain-group-only'
    });
    label.appendChild(checkbox);
    label.appendChild(createText(' ' + g.name));
    onlyGroupsList.appendChild(label);
  });

  groupSelection.appendChild(onlyGroupsList);

  // "All except these groups" option
  const exceptGroupsLabel = createElement('label', { className: 'radio-group' });
  const exceptGroupsRadio = createElement('input', {
    attributes: {
      type: 'radio',
      name: `grouping-${d.id}`,
      value: 'except',
      ...(hasGroups && groupMode === 'except' ? { checked: '' } : {})
    },
    className: 'edit-domain-grouping'
  });
  exceptGroupsLabel.appendChild(exceptGroupsRadio);
  exceptGroupsLabel.appendChild(createText(' All groups except:'));
  groupSelection.appendChild(exceptGroupsLabel);

  const exceptGroupsList = createElement('div', {
    className: `checkbox-list${hasGroups && groupMode === 'except' ? ' visible' : ''}`,
    attributes: { 'data-mode': 'except' }
  });

  groups.forEach(g => {
    const label = createElement('label');
    const checkbox = createElement('input', {
      attributes: {
        type: 'checkbox',
        value: g.name,
        ...(hasGroups && groupMode === 'except' && d.groups!.includes(g.name) ? { checked: '' } : {})
      },
      className: 'edit-domain-group-except'
    });
    label.appendChild(checkbox);
    label.appendChild(createText(' ' + g.name));
    exceptGroupsList.appendChild(label);
  });

  groupSelection.appendChild(exceptGroupsList);

  editMode.appendChild(groupSelection);

  // Add event listeners to show/hide group lists
  const groupingRadios = editMode.querySelectorAll('.edit-domain-grouping');
  groupingRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = (radio as HTMLInputElement).value;
      const onlyList = groupSelection.querySelector('[data-mode="only"]') as HTMLElement;
      const exceptList = groupSelection.querySelector('[data-mode="except"]') as HTMLElement;

      onlyList.classList.toggle('visible', selected === 'only');
      exceptList.classList.toggle('visible', selected === 'except');
    });
  });

  // Button group
  const buttonGroup = createElement('div', { className: 'button-group' });
  const saveBtn = createElement('button', {
    textContent: 'Save Changes',
    className: 'primary save-domain-btn'
  });
  const cancelBtn = createElement('button', {
    textContent: 'Cancel',
    className: 'secondary cancel-domain-btn'
  });

  saveBtn.addEventListener('click', () => saveDomainFromCard(card));
  cancelBtn.addEventListener('click', () => cancelDomainEdit(card));

  buttonGroup.appendChild(saveBtn);
  buttonGroup.appendChild(cancelBtn);
  editMode.appendChild(buttonGroup);

  card.appendChild(editMode);

  return card;
}

async function saveDomainFromCard(card: HTMLElement) {
  const id = card.getAttribute('data-id');

  const domainInput = card.querySelector('.edit-domain-input') as HTMLInputElement;
  const domain = domainInput.value.trim();

  if (!domain) {
    showToast('Domain is required', 'warning');
    return;
  }

  // Get selected match mode
  const matchModeRadio = card.querySelector('.edit-domain-match-mode:checked') as HTMLInputElement;
  const matchMode = (matchModeRadio?.value || 'domain-and-www') as 'domain-and-www' | 'all-subdomains' | 'exact';

  // Get selected mode (light/dark)
  const modeRadio = card.querySelector('.edit-domain-mode:checked') as HTMLInputElement;
  const mode = (modeRadio?.value || 'light') as 'light' | 'dark';

  // Get selected grouping mode
  const groupingRadio = card.querySelector('.edit-domain-grouping:checked') as HTMLInputElement;
  const groupingMode = groupingRadio?.value || 'all';

  const newDomain: Domain = {
    id: id || crypto.randomUUID(),
    domain,
    matchMode,
    mode,
  };

  // Set groups based on grouping mode
  if (groupingMode === 'only') {
    const onlyCheckboxes = card.querySelectorAll('.edit-domain-group-only:checked');
    const selectedGroups = Array.from(onlyCheckboxes).map(cb => (cb as HTMLInputElement).value);
    if (selectedGroups.length > 0) {
      newDomain.groups = selectedGroups;
      newDomain.groupMode = 'only';
    }
  } else if (groupingMode === 'except') {
    const exceptCheckboxes = card.querySelectorAll('.edit-domain-group-except:checked');
    const selectedGroups = Array.from(exceptCheckboxes).map(cb => (cb as HTMLInputElement).value);
    if (selectedGroups.length > 0) {
      newDomain.groups = selectedGroups;
      newDomain.groupMode = 'except';
    }
  }

  if (id) {
    // Update existing domain
    const index = domains.findIndex(d => d.id === id);
    if (index !== -1) {
      domains[index] = newDomain;
    }
    await saveDomains(domains);
    showToast('Domain updated successfully! Remember to grant permissions (🔓 button or Settings tab).');
  } else {
    // Add new domain
    domains.push(newDomain);
    await saveDomains(domains);
    showToast('Domain added successfully! Remember to grant permissions (🔓 button or Settings tab).');
  }

  render();
}

function cancelDomainEdit(card: HTMLElement) {
  const id = card.getAttribute('data-id');
  if (id) {
    // Existing domain - switch back to view mode
    card.classList.remove('editing');
    card.classList.add('viewing');
  } else {
    // New domain - remove the card
    card.remove();
  }
}

// Event delegation for groups list
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
