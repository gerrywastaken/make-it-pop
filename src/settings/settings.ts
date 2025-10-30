// Inline types
interface Group {
  id: string;
  name: string;
  color: string;
  phrases: string[];
}

interface Domain {
  id: string;
  pattern: string;
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

let groups: Group[] = [];
let domains: Domain[] = [];
let editingGroupId: string | null = null;
let editingDomainId: string | null = null;

async function init() {
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
      <strong>${g.name}</strong>
      <span style="background: ${g.color}; padding: 2px 8px;">${g.color}</span>
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
        <strong>${d.pattern}</strong> - ${groupsDisplay}
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
  const colorInput = document.getElementById('groupColor') as HTMLInputElement;
  const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

  const name = nameInput.value.trim();
  const color = colorInput.value;
  const phrases = phrasesInput.value.split('\n').map(p => p.trim()).filter(Boolean);

  if (!name || phrases.length === 0) return;

  if (editingGroupId) {
    // Update existing group
    const index = groups.findIndex(g => g.id === editingGroupId);
    if (index !== -1) {
      groups[index] = {
        id: editingGroupId,
        name,
        color,
        phrases,
      };
    }
    editingGroupId = null;
  } else {
    // Add new group
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      color,
      phrases,
    };
    groups.push(newGroup);
  }

  await saveGroups(groups);

  nameInput.value = '';
  phrasesInput.value = '';
  render();
});

document.getElementById('addDomain')!.addEventListener('click', async () => {
  const patternInput = document.getElementById('domainPattern') as HTMLInputElement;
  const pattern = patternInput.value.trim();

  if (!pattern) return;

  const checkboxes = document.querySelectorAll<HTMLInputElement>('.domain-group-checkbox:checked');
  const groupIds = Array.from(checkboxes).map(cb => cb.value);

  if (editingDomainId) {
    // Update existing domain
    const index = domains.findIndex(d => d.id === editingDomainId);
    if (index !== -1) {
      domains[index] = {
        id: editingDomainId,
        pattern,
        groupIds,
      };
    }
    editingDomainId = null;
  } else {
    // Add new domain
    const newDomain: Domain = {
      id: crypto.randomUUID(),
      pattern,
      groupIds,
    };
    domains.push(newDomain);
  }

  await saveDomains(domains);

  patternInput.value = '';
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
    const colorInput = document.getElementById('groupColor') as HTMLInputElement;
    const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

    nameInput.value = group.name;
    colorInput.value = group.color;
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
  const colorInput = document.getElementById('groupColor') as HTMLInputElement;
  const phrasesInput = document.getElementById('groupPhrases') as HTMLTextAreaElement;

  nameInput.value = '';
  colorInput.value = '#ffff00';
  phrasesInput.value = '';

  render();
});

document.getElementById('cancelDomain')!.addEventListener('click', () => {
  editingDomainId = null;

  const patternInput = document.getElementById('domainPattern') as HTMLInputElement;
  patternInput.value = '';

  const checkboxes = document.querySelectorAll<HTMLInputElement>('.domain-group-checkbox:checked');
  checkboxes.forEach(cb => cb.checked = false);

  render();
});

init();
