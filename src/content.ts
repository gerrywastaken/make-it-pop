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
// The recursive traversal will naturally catch subsequent matches in the new text nodes
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

// Debounce utility
function debounce(func: Function, wait: number): Function {
  let timeout: number;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

// Global state for highlighting with concurrency control
let globalPhraseMap: PhraseMap | null = null;
let globalMode: 'light' | 'dark' = 'light'; // Track current mode for styling
let shouldHighlight = false; // Flag indicating highlight needed
let isHighlighting = false; // Lock to prevent concurrent execution
let currentLoopNumber = 0; // Unique ID for each highlighting pass

function highlightNewContent() {
  if (!globalPhraseMap || isHighlighting) return;

  isHighlighting = true;
  shouldHighlight = false;
  currentLoopNumber = Math.floor(Math.random() * 1000000000); // Random loop ID to track this pass

  try {
    walkTextNodes(document.body, globalPhraseMap, currentLoopNumber);
  } finally {
    isHighlighting = false;
  }
}

const debouncedHighlight = debounce(highlightNewContent, 3000);

async function highlightPage() {
  // Check if extension is enabled
  const enabledData = await browserAPI.storage.local.get('enabled');
  const enabled = enabledData.enabled !== false; // Default to true if not set
  if (!enabled) return;

  const hostname = window.location.hostname;
  const domains = await getDomains();

  const matchedDomain = domains.find(d => matchesDomain(d, hostname));
  if (!matchedDomain) return;

  const allGroups = await getGroups();

  // Step 1: Start with all enabled groups
  let activeGroups = allGroups.filter(g => g.enabled);

  // Step 2: Apply domain filters if specified
  if (matchedDomain.groups && matchedDomain.groups.length > 0) {
    const groupMode = matchedDomain.groupMode || 'only'; // Default to 'only'

    if (groupMode === 'only') {
      // Include only specified groups
      activeGroups = activeGroups.filter(g => matchedDomain.groups!.includes(g.name));
    } else if (groupMode === 'except') {
      // Exclude specified groups
      activeGroups = activeGroups.filter(g => !matchedDomain.groups!.includes(g.name));
    }
  }

  // If no active groups after filtering, return
  if (activeGroups.length === 0) return;

  const mode = matchedDomain.mode;
  const phraseMap: PhraseMap = new Map();

  for (const group of activeGroups) {
    const bgColor = mode === 'dark' ? group.darkBgColor : group.lightBgColor;
    const textColor = mode === 'dark' ? group.darkTextColor : group.lightTextColor;

    for (const phrase of group.phrases) {
      phraseMap.set(phrase, { bgColor, textColor });
    }
  }

  globalPhraseMap = phraseMap;
  globalMode = mode; // Store mode globally for styling

  // Initial highlight
  currentLoopNumber = Math.floor(Math.random() * 1000000000);
  walkTextNodes(document.body, phraseMap, currentLoopNumber);

  // Set up MutationObserver for dynamic content
  // Observer just sets flag, debounced function does actual work to avoid excessive re-highlights
  const observer = new MutationObserver((mutations) => {
    shouldHighlight = true;
    debouncedHighlight();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
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

initHighlighting();
