/**
 * Domain card component - handles creation and interaction for domain cards in settings
 */

import type { Domain } from '../types';
import { createElement, createText, showToast } from '../utils/dom';
import { getDomains } from '../utils/storage';
import { getGroups } from '../utils/storage';
import { addOrUpdateDomainWithPermission } from '../../storage';

// Module-level state (will be initialized by parent)
let domains: Domain[] = [];
let groups: any[] = [];
let render: () => void = () => {};

export function initDomainCard(initialDomains: Domain[], initialGroups: any[], renderFn: () => void) {
  domains = initialDomains;
  groups = initialGroups;
  render = renderFn;
}

export function updateDomainsState(newDomains: Domain[]) {
  domains = newDomains;
}

export function updateGroupsReference(newGroups: any[]) {
  groups = newGroups;
}

export function createDomainCard(d: Domain): HTMLElement {
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

  // Use shared function to add/update domain with permission request
  addOrUpdateDomainWithPermission(newDomain, domains).then(granted => {
    // Update local copy
    if (id) {
      const index = domains.findIndex(d => d.id === id);
      if (index !== -1) {
        domains[index] = newDomain;
      }
    } else {
      domains.push(newDomain);
    }

    // Show appropriate toast
    if (granted) {
      showToast(id ? 'Domain updated and permissions granted!' : 'Domain added and permissions granted!');
    } else {
      showToast(
        id
          ? 'Domain updated, but permissions were denied. Click 🔓 to grant permissions.'
          : 'Domain added, but permissions were denied. Click 🔓 to grant permissions.',
        'warning'
      );
    }

    render();
  });
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
