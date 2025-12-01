/**
 * Group card component - handles creation and interaction for group cards in settings
 */

import type { Group } from '../types';
import { createElement, createText, showToast } from '../utils/dom';
import { getGroups, saveGroups } from '../utils/storage';

// Module-level state for groups (will be initialized by parent)
let groups: Group[] = [];
let render: () => void = () => {};

export function initGroupCard(initialGroups: Group[], renderFn: () => void) {
  groups = initialGroups;
  render = renderFn;
}

export function updateGroupsState(newGroups: Group[]) {
  groups = newGroups;
}

export function createGroupCard(g: Group): HTMLElement {
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
