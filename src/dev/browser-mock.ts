// Browser API mock for standalone UI development
// This allows developing the settings UI without loading the full extension

interface MockStorage {
  enabled?: boolean;
  groups: any[];
  domains: any[];
  theme?: 'light' | 'auto' | 'dark';
}

const mockStorage: MockStorage = {
  enabled: true,
  theme: 'auto',
  groups: [
    {
      id: 'mock-group-1',
      name: 'Key Terms',
      enabled: true,
      lightBgColor: '#ffff00',
      lightTextColor: '#000000',
      darkBgColor: '#e5a50a',
      darkTextColor: '#000000',
      phrases: ['code review', 'pull request', 'merge conflict', 'technical debt']
    },
    {
      id: 'mock-group-2',
      name: 'Important Actions',
      enabled: true,
      lightBgColor: '#f66151',
      lightTextColor: '#000000',
      darkBgColor: '#a51d2d',
      darkTextColor: '#ffffff',
      phrases: ['needs attention', 'breaking change', 'security issue']
    },
    {
      id: 'mock-group-3',
      name: 'Positive Indicators',
      enabled: false,
      lightBgColor: '#51cf66',
      lightTextColor: '#000000',
      darkBgColor: '#1e4620',
      darkTextColor: '#ffffff',
      phrases: ['approved', 'looks good', 'well done']
    }
  ],
  domains: [
    {
      id: 'mock-domain-1',
      domain: 'github.com',
      matchMode: 'domain-and-www',
      mode: 'light',
      groups: ['Key Terms', 'Important Actions'],
      groupMode: 'only'
    },
    {
      id: 'mock-domain-2',
      domain: 'example.com',
      matchMode: 'all-subdomains',
      mode: 'dark'
    }
  ]
};

// Create mock chrome/browser API
const mockBrowserAPI = {
  storage: {
    local: {
      get: async (keys: string | string[]): Promise<any> => {
        console.log('[Mock] storage.local.get:', keys);
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const result: any = {};
        for (const key of keyArray) {
          if (key in mockStorage) {
            result[key] = JSON.parse(JSON.stringify(mockStorage[key as keyof MockStorage]));
          }
        }
        return result;
      },
      set: async (items: any): Promise<void> => {
        console.log('[Mock] storage.local.set:', items);
        for (const [key, value] of Object.entries(items)) {
          if (key in mockStorage) {
            (mockStorage as any)[key] = JSON.parse(JSON.stringify(value));
          }
        }
      }
    },
    onChanged: {
      addListener: (callback: any) => {
        console.log('[Mock] storage.onChanged.addListener registered');
      }
    }
  },
  permissions: {
    contains: async (permissions: any): Promise<boolean> => {
      console.log('[Mock] permissions.contains:', permissions);
      // Simulate having some permissions
      return false;
    },
    request: async (permissions: any): Promise<boolean> => {
      console.log('[Mock] permissions.request:', permissions);
      // Simulate granting permission
      alert(`[Dev Mock] Permission requested for:\n${JSON.stringify(permissions.origins, null, 2)}\n\n(In dev mode, permissions are always granted)`);
      return true;
    }
  },
  runtime: {
    getManifest: () => ({
      version: '1.0.3-dev',
      name: 'Make It Pop (Dev)',
      description: 'Development mode'
    }),
    openOptionsPage: () => {
      console.log('[Mock] runtime.openOptionsPage() called');
      alert('[Dev Mock] Opening settings page...\n\nIn production, this would open the extension settings.');
      // In dev mode, could open settings-dev.html in a new tab
      window.open('/dev/settings-dev.html', '_blank');
    }
  },
  tabs: {
    query: async (queryInfo: any): Promise<any[]> => {
      console.log('[Mock] tabs.query:', queryInfo);
      // Return a mock tab with a test URL
      return [{
        id: 1,
        url: 'https://github.com/anthropics/claude-code',
        active: true,
        windowId: 1,
        title: 'Mock Tab - GitHub'
      }];
    },
    reload: async (tabId: number): Promise<void> => {
      console.log('[Mock] tabs.reload:', tabId);
      console.log('[Mock] Tab reload simulated - in a real extension this would reload the tab');
    }
  }
};

// Inject mocks into global scope
(window as any).chrome = mockBrowserAPI;
(window as any).browser = mockBrowserAPI;

console.log('[Mock] Browser APIs mocked for standalone development');
console.log('[Mock] Initial data:', mockStorage);
