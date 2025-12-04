// Background service worker for dynamic content script injection
// Only injects on domains that the user has configured

// Inline types to avoid imports in background script
interface Domain {
  id: string;
  domain: string;  // Just the domain without wildcards (e.g., "linkedin.com")
  matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';
  mode: 'light' | 'dark';
  groups?: string[];
  groupMode?: 'only' | 'except';
}

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Get domains from storage
async function getDomains(): Promise<Domain[]> {
  const data = await browserAPI.storage.local.get('domains');
  return data.domains || [];
}

// Check if a hostname matches a domain configuration
function matchesDomain(domainConfig: Domain, hostname: string): boolean {
  const { domain, matchMode } = domainConfig;

  switch (matchMode) {
    case 'domain-and-www':
      return hostname === domain || hostname === `www.${domain}`;
    case 'all-subdomains':
      return hostname === domain || hostname.endsWith(`.${domain}`);
    case 'exact':
      return hostname === domain;
    default:
      return false;
  }
}

// Convert domain config to host pattern for permissions
function domainToHostPattern(domainConfig: Domain): string {
  const { domain, matchMode } = domainConfig;

  switch (matchMode) {
    case 'domain-and-www':
      // Return both patterns
      return `*://${domain}/*`;
    case 'all-subdomains':
      return `*://*.${domain}/*`;
    case 'exact':
      return `*://${domain}/*`;
    default:
      return `*://${domain}/*`;
  }
}

// Get all unique host patterns needed for configured domains
async function getRequiredHostPatterns(): Promise<string[]> {
  const domains = await getDomains();
  const patterns = new Set<string>();

  for (const domain of domains) {
    patterns.add(domainToHostPattern(domain));

    // For domain-and-www, add both patterns
    if (domain.matchMode === 'domain-and-www') {
      patterns.add(`*://www.${domain.domain}/*`);
    }
  }

  return Array.from(patterns);
}

// Check if we should inject on this tab
async function shouldInjectOnTab(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Skip non-http(s) URLs
    if (!urlObj.protocol.startsWith('http')) {
      return false;
    }

    const domains = await getDomains();

    // Check if this hostname matches any configured domain
    const matchedDomain = domains.find(d => matchesDomain(d, hostname));
    return !!matchedDomain;
  } catch (e) {
    return false;
  }
}

// Inject content script into a tab
async function injectContentScript(tabId: number) {
  try {
    // Check if we already injected by trying to send a message
    // If the content script is already loaded, this will succeed
    try {
      await browserAPI.tabs.sendMessage(tabId, { type: 'ping' });
      // If we get here, content script is already loaded
      return;
    } catch (e) {
      // Content script not loaded, proceed with injection
    }

    await browserAPI.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (error) {
    console.error('Failed to inject content script:', error);
  }
}

// Handle tab updates (page loads, URL changes)
browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only proceed when the page is fully loaded
  if (changeInfo.status !== 'complete') {
    return;
  }

  const url = tab.url;
  if (!url) {
    return;
  }

  console.log('[MakeItPop Background] Tab loaded:', url);

  // Check if we should inject on this tab
  const shouldInject = await shouldInjectOnTab(url);
  console.log('[MakeItPop Background] Should inject:', shouldInject);
  if (!shouldInject) {
    return;
  }

  // Check if we have permission for this URL
  const hasPermission = await browserAPI.permissions.contains({
    origins: [url]
  });
  console.log('[MakeItPop Background] Has permission for', url, ':', hasPermission);

  if (hasPermission) {
    console.log('[MakeItPop Background] Injecting content script into tab', tabId);
    await injectContentScript(tabId);
  } else {
    console.log('[MakeItPop Background] No permission for', url, '- skipping injection');
  }
});

// Listen for when NEW domains are added to storage
// (Don't re-inject when existing domain configs are modified - content scripts handle that)
browserAPI.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  // Only inject if domains were ADDED (not just modified)
  if (changes.domains) {
    const oldDomains = changes.domains.oldValue || [];
    const newDomains = changes.domains.newValue || [];

    // Check if any new domains were added
    const domainsAdded = newDomains.length > oldDomains.length;

    if (!domainsAdded) {
      console.log('[MakeItPop Background] Domains modified (not added) - content scripts will handle re-highlighting');
      return;
    }

    console.log('[MakeItPop Background] New domains added, checking open tabs...');
    // Get all tabs and check if we should inject
    const tabs = await browserAPI.tabs.query({});

    for (const tab of tabs) {
      if (!tab.url || !tab.id) {
        continue;
      }

      const shouldInject = await shouldInjectOnTab(tab.url);
      if (!shouldInject) {
        continue;
      }

      console.log('[MakeItPop Background] Checking permissions for open tab:', tab.url);
      // Check if we have permission
      const hasPermission = await browserAPI.permissions.contains({
        origins: [tab.url]
      });

      if (hasPermission) {
        console.log('[MakeItPop Background] Injecting into open tab:', tab.id);
        await injectContentScript(tab.id);
      }
    }
  }
});

// Handle messages from settings page or popup to request permissions
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'requestPermission') {
    const { origins } = message;

    browserAPI.permissions.request({
      origins
    }).then(granted => {
      sendResponse({ granted });

      // If granted, inject on all matching tabs
      if (granted) {
        browserAPI.tabs.query({}).then(tabs => {
          for (const tab of tabs) {
            if (!tab.url || !tab.id) continue;

            shouldInjectOnTab(tab.url).then(shouldInject => {
              if (shouldInject) {
                injectContentScript(tab.id);
              }
            });
          }
        });
      }
    });

    // Return true to indicate we'll call sendResponse asynchronously
    return true;
  }

  if (message.type === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
});

console.log('Make It Pop background service worker loaded');
