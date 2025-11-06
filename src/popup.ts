const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Load current enabled state
async function loadState() {
  const data = await browserAPI.storage.local.get('enabled');
  const enabled = data.enabled !== false; // Default to true if not set

  const toggle = document.getElementById('enableToggle') as HTMLInputElement;
  const status = document.getElementById('status')!;

  toggle.checked = enabled;
  status.textContent = enabled ? 'Active' : 'Disabled';
  status.style.color = enabled ? '#4CAF50' : '#999';
}

// Save enabled state when toggle changes
document.getElementById('enableToggle')!.addEventListener('change', async (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  await browserAPI.storage.local.set({ enabled });

  const status = document.getElementById('status')!;
  status.textContent = enabled ? 'Active' : 'Disabled';
  status.style.color = enabled ? '#4CAF50' : '#999';

  // Reload current tab to apply changes
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browserAPI.tabs.reload(tabs[0].id);
  }
});

document.getElementById('openSettings')!.addEventListener('click', () => {
  browserAPI.runtime.openOptionsPage();
  window.close();
});

loadState();
