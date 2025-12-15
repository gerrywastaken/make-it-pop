import { browserAPI } from './browserApi';

type Theme = 'light' | 'auto' | 'dark';

/**
 * Gets the current theme preference from storage
 */
export async function getTheme(): Promise<Theme> {
  const data = await browserAPI.storage.local.get('theme');
  return (data.theme as Theme) || 'auto';
}

/**
 * Saves the theme preference to storage
 */
export async function setTheme(theme: Theme): Promise<void> {
  await browserAPI.storage.local.set({ theme });
  applyTheme(theme);
}

/**
 * Gets the effective theme based on preference and system settings
 */
function getEffectiveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Gets the current effective theme (resolves 'auto' to actual light/dark)
 */
export async function getEffectiveThemeValue(): Promise<'light' | 'dark'> {
  const preference = await getTheme();
  return getEffectiveTheme(preference);
}

/**
 * Applies the theme to the document
 */
export function applyTheme(preference: Theme): void {
  const effectiveTheme = getEffectiveTheme(preference);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

/**
 * Initializes the theme system
 * - Loads theme from storage
 * - Applies it to the document
 * - Sets up listener for system theme changes (when in auto mode)
 */
export async function initTheme(): Promise<void> {
  const theme = await getTheme();
  applyTheme(theme);

  // Listen for system theme changes (only matters in auto mode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const currentTheme = await getTheme();
    if (currentTheme === 'auto') {
      applyTheme(currentTheme);
    }
  });

  // Listen for theme changes from other tabs/windows
  browserAPI.storage.onChanged.addListener((changes) => {
    if (changes.theme) {
      applyTheme(changes.theme.newValue || 'auto');
    }
  });
}
