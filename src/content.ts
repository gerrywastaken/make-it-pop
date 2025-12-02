import { findMatches, type Match, type PhraseMap } from './matcher.js';

// Inline types to avoid imports
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

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Debug logging infrastructure
let debugEnabled = false;

function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function debugLog(component: string, message: string, data?: any) {
  if (!debugEnabled) return;
  const timestamp = getTimestamp();
  if (data !== undefined) {
    console.log(`[${timestamp}] [Make It Pop - ${component}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [Make It Pop - ${component}] ${message}`);
  }
}

// Expose debug toggle globally
(window as any).makeItLog = () => {
  debugEnabled = !debugEnabled;
  console.log(`[Make It Pop] Debug logging ${debugEnabled ? 'ENABLED ✓' : 'DISABLED ✗'}`);
  if (debugEnabled) {
    console.log('[Make It Pop] Logs will show with format: [HH:MM:SS.mmm] [Component] Message');
  }
};

// Inline storage functions to avoid code splitting issues
async function getGroups(): Promise<Group[]> {
  const data = await browserAPI.storage.local.get('groups');
  return data.groups || [];
}

async function getDomains(): Promise<Domain[]> {
  const data = await browserAPI.storage.local.get('domains');
  return data.domains || [];
}

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

// Process ONE match at a time using atomic operations to prevent race conditions
// Recursively process the remaining text after each highlight
function highlightTextNode(node: Text, phraseMap: PhraseMap, loopNumber: number) {
  const text = node.textContent || '';
  if (text.trim() === '') return;

  const matches = findMatches(text, phraseMap);
  if (matches.length === 0) return;

  const parent = node.parentNode;
  if (!parent) return;

  // Only process the FIRST match - atomic operations prevent race conditions
  const match = matches[0];

  try {
    // Split text node at match position (atomic operation)
    const after = node.splitText(match.start);

    // Remove matched portion from the "after" node (atomic operation)
    after.nodeValue = after.nodeValue!.substring(match.end - match.start);

    // Create highlight span
    const span = document.createElement('span');
    span.style.backgroundColor = match.bgColor;
    span.style.color = match.textColor;
    span.style.padding = '2px 4px';
    span.style.boxShadow = '1px 1px rgba(0, 0, 0, 0.2)';
    span.style.borderRadius = '3px';
    span.style.fontStyle = 'inherit';
    span.setAttribute('data-makeitpop-highlight', 'true');
    span.setAttribute('data-makeitpop-loop', loopNumber.toString());
    span.textContent = text.slice(match.start, match.end);

    // Insert highlight between the two text nodes (atomic operation)
    parent.insertBefore(span, after);

    // Recursively process the remaining text node for more matches
    highlightTextNode(after, phraseMap, loopNumber);
  } catch (e) {
    // Node was removed by framework during operation - bail out gracefully
    return;
  }
}

// Elements we should never highlight inside
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
  'SELECT', 'OPTION', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED'
]);

function shouldSkipElement(element: Element): boolean {
  // Skip if it's one of the forbidden tags
  if (SKIP_TAGS.has(element.tagName)) {
    return true;
  }
  // Skip contenteditable elements (rich text editors)
  if ((element as HTMLElement).isContentEditable) {
    return true;
  }

  // No React detection needed - atomic operations work fine with React
  return false;
}

function walkTextNodes(node: Node, phraseMap: PhraseMap, loopNumber: number) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (!parent) return;

    // Skip if parent is a forbidden element
    if (parent.nodeType === Node.ELEMENT_NODE && shouldSkipElement(parent as Element)) {
      return;
    }

    // Skip if parent is already a highlight span from THIS loop
    // (Highlights from previous loops will be encountered as elements below)
    if ((parent as Element).hasAttribute?.('data-makeitpop-highlight')) {
      const parentLoop = (parent as Element).getAttribute('data-makeitpop-loop');
      if (parentLoop === loopNumber.toString()) {
        return; // Already processed in this loop
      }
    }

    highlightTextNode(node as Text, phraseMap, loopNumber);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;

    // Skip our own highlight spans (but we'll traverse children to re-count)
    if (element.hasAttribute('data-makeitpop-highlight')) {
      return; // Don't traverse into highlights
    }

    // Skip forbidden elements entirely
    if (shouldSkipElement(element)) {
      return;
    }

    // Use Array.from to avoid live NodeList issues during DOM manipulation
    const children = Array.from(node.childNodes);
    for (const child of children) {
      walkTextNodes(child, phraseMap, loopNumber);
    }
  }
}

// Debounce utility - simpler approach for better reliability
function debounce(func: Function, wait: number): Function {
  let timeout: number | undefined;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

// Highlighter class - extracted for testability
export class Highlighter {
  private phraseMap: PhraseMap | null = null;
  private mode: 'light' | 'dark' = 'light';
  private isHighlighting = false;
  private currentLoopNumber = 0;
  private mutationsPending = false;
  private observer: MutationObserver | null = null;
  private debouncedHighlight: Function;
  private rootElement: HTMLElement;

  constructor(rootElement: HTMLElement = document.body, debounceMs: number = 1500) {
    this.rootElement = rootElement;
    this.debouncedHighlight = debounce(() => this.highlightAll(), debounceMs);
  }

  setPhrases(phraseMap: PhraseMap, mode: 'light' | 'dark') {
    this.phraseMap = phraseMap;
    this.mode = mode;
  }

  private highlightAll() {
    if (!this.phraseMap || this.isHighlighting || !this.mutationsPending) return;

    this.isHighlighting = true;
    this.mutationsPending = false;
    this.currentLoopNumber++;

    try {
      walkTextNodes(this.rootElement, this.phraseMap, this.currentLoopNumber);
    } finally {
      this.isHighlighting = false;
    }
  }

  start() {
    if (!this.phraseMap) return;

    // Initial highlight
    this.currentLoopNumber = 0;
    walkTextNodes(this.rootElement, this.phraseMap, this.currentLoopNumber);

    // Set up MutationObserver
    this.observer = new MutationObserver((mutations) => {
      let hasRelevantMutation = false;

      for (const mutation of mutations) {
        if (mutation.target.nodeType === Node.ELEMENT_NODE) {
          const element = mutation.target as Element;
          if (element.hasAttribute?.('data-makeitpop-highlight')) {
            continue;
          }
        }

        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentNode;
          if (parent && parent.nodeType === Node.ELEMENT_NODE) {
            const parentElement = parent as Element;
            if (parentElement.hasAttribute?.('data-makeitpop-highlight')) {
              continue;
            }
          }
          hasRelevantMutation = true;
          break;
        } else if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.hasAttribute?.('data-makeitpop-highlight')) {
                  continue;
                }
              }
              hasRelevantMutation = true;
              break;
            }
          }
          if (hasRelevantMutation) break;

          if (mutation.removedNodes.length > 0) {
            hasRelevantMutation = true;
            break;
          }
        }
      }

      if (hasRelevantMutation) {
        this.mutationsPending = true;
        this.debouncedHighlight();
      }
    });

    this.observer.observe(this.rootElement, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false,
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Keep track of current highlighter instance
let currentHighlighter: Highlighter | null = null;

async function highlightPage() {
  debugLog('Content', 'highlightPage() called');

  // Check if extension is enabled
  const enabledData = await browserAPI.storage.local.get('enabled');
  const enabled = enabledData.enabled !== false; // Default to true if not set
  debugLog('Content', 'Extension enabled check', { enabled });
  if (!enabled) {
    debugLog('Content', 'Extension disabled, skipping highlighting');
    return;
  }

  const hostname = window.location.hostname;
  const domains = await getDomains();
  debugLog('Content', 'Fetched domains', { hostname, domainsCount: domains.length });

  const matchedDomain = domains.find(d => matchesDomain(d, hostname));
  if (!matchedDomain) {
    debugLog('Content', 'No matching domain configuration found', { hostname });
    return;
  }
  debugLog('Content', 'Matched domain', {
    domain: matchedDomain.domain,
    mode: matchedDomain.mode,
    groupMode: matchedDomain.groupMode,
    configuredGroups: matchedDomain.groups
  });

  const allGroups = await getGroups();
  debugLog('Content', 'Fetched groups', {
    totalGroups: allGroups.length,
    enabledGroups: allGroups.filter(g => g.enabled).length,
    groupNames: allGroups.map(g => `${g.name}${g.enabled ? ' ✓' : ' ✗'}`)
  });

  // Step 1: Start with all enabled groups
  let activeGroups = allGroups.filter(g => g.enabled);

  // Step 2: Apply domain filters if specified
  if (matchedDomain.groups !== undefined && matchedDomain.groupMode) {
    const groupMode = matchedDomain.groupMode;
    const beforeFiltering = activeGroups.length;

    if (groupMode === 'only') {
      // Include only specified groups (empty array = no groups = no highlights)
      activeGroups = activeGroups.filter(g => matchedDomain.groups!.includes(g.name));
    } else if (groupMode === 'except') {
      // Exclude specified groups (empty array = exclude none = all groups)
      activeGroups = activeGroups.filter(g => !matchedDomain.groups!.includes(g.name));
    }

    debugLog('Content', 'Group filtering applied', {
      mode: groupMode,
      configuredGroups: matchedDomain.groups,
      beforeFiltering,
      afterFiltering: activeGroups.length,
      activeGroupNames: activeGroups.map(g => g.name)
    });
  } else {
    debugLog('Content', 'No group filtering (using all enabled groups)', {
      activeGroupNames: activeGroups.map(g => g.name)
    });
  }

  // If no active groups after filtering, return
  if (activeGroups.length === 0) {
    debugLog('Content', 'No active groups after filtering, skipping highlighting');
    return;
  }

  const mode = matchedDomain.mode;
  const phraseMap: PhraseMap = new Map();

  for (const group of activeGroups) {
    const bgColor = mode === 'dark' ? group.darkBgColor : group.lightBgColor;
    const textColor = mode === 'dark' ? group.darkTextColor : group.lightTextColor;

    for (const phrase of group.phrases) {
      phraseMap.set(phrase, { bgColor, textColor });
    }
  }

  // Use the new Highlighter class and store it globally
  currentHighlighter = new Highlighter();
  currentHighlighter.setPhrases(phraseMap, mode);
  currentHighlighter.start();
}

// Remove all existing highlights from the page
function clearHighlights() {
  if (currentHighlighter) {
    currentHighlighter.stop();
    currentHighlighter = null;
  }

  // Remove all highlight spans
  const highlights = document.querySelectorAll('[data-makeitpop-highlight]');
  highlights.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      // Replace the span with its text content
      const textNode = document.createTextNode(span.textContent || '');
      parent.replaceChild(textNode, span);
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }
  });
}

// Re-highlight the page (clear old highlights and apply new ones)
async function reHighlightPage() {
  debugLog('Content', 'reHighlightPage() called');
  const highlightsBefore = document.querySelectorAll('[data-makeitpop-highlight]').length;
  debugLog('Content', `Clearing ${highlightsBefore} existing highlights`);

  clearHighlights();

  await highlightPage();

  const highlightsAfter = document.querySelectorAll('[data-makeitpop-highlight]').length;
  debugLog('Content', 'Re-highlight complete', {
    highlightsBefore,
    highlightsAfter,
    delta: highlightsAfter - highlightsBefore
  });
}

// Wait for page to fully load and React hydration to complete before highlighting
function initHighlighting() {
  // If page is already loaded, wait a bit for hydration
  if (document.readyState === 'complete') {
    // Give React time to hydrate (typical hydration takes 100-500ms)
    setTimeout(highlightPage, 500);
  } else {
    // Wait for full page load, then delay for hydration
    window.addEventListener('load', () => {
      setTimeout(highlightPage, 500);
    });
  }
}

// Debounced re-highlight to prevent race conditions from rapid storage changes
let reHighlightTimeout: number | undefined;
const debouncedReHighlight = () => {
  debugLog('Content', 'Debounce timer reset/started', { delayMs: 300 });
  clearTimeout(reHighlightTimeout);
  reHighlightTimeout = window.setTimeout(() => {
    debugLog('Content', 'Debounce timer fired → calling reHighlightPage()');
    reHighlightPage();
  }, 300); // Wait 300ms after last change before re-highlighting
};

// Listen for storage changes to re-highlight when settings are updated
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Check if groups or domains changed
    if (changes.groups || changes.domains || changes.enabled) {
      debugLog('Content', 'Storage change detected', {
        changedKeys: Object.keys(changes),
        domains: changes.domains ? {
          oldLength: changes.domains.oldValue?.length,
          newLength: changes.domains.newValue?.length
        } : undefined,
        groups: changes.groups ? {
          oldLength: changes.groups.oldValue?.length,
          newLength: changes.groups.newValue?.length
        } : undefined,
        enabled: changes.enabled ? {
          old: changes.enabled.oldValue,
          new: changes.enabled.newValue
        } : undefined
      });
      debouncedReHighlight();
    }
  }
});

initHighlighting();
