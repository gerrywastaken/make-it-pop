// Content script for Make It Pop - highlights phrases on web pages
import { findMatches, clearMatcherCache, type Match, type PhraseMap } from './matcher.js';
import {
  browserAPI,
  getGroups,
  getDomains,
  getEnabled,
  getDebugMode,
  onStorageChanged,
} from './browserApi.js';
import type { Group, Domain } from './types.js';

// =============================================================================
// Debug Logging
// =============================================================================

let debugEnabled = false;

function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function debugLog(message: string, data?: any) {
  if (!debugEnabled) return;
  if (data !== undefined) {
    console.log(`[${getTimestamp()}] [Make It Pop] ${message}`, data);
  } else {
    console.log(`[${getTimestamp()}] [Make It Pop] ${message}`);
  }
}

async function initDebugMode() {
  debugEnabled = await getDebugMode();
  if (debugEnabled) {
    console.log('[Make It Pop] Debug logging enabled');
  }
}

onStorageChanged((changes) => {
  if (changes.debugMode) {
    debugEnabled = Boolean(changes.debugMode.newValue);
    console.log(`[Make It Pop] Debug logging ${debugEnabled ? 'ENABLED' : 'DISABLED'}`);
  }
});

initDebugMode();

// =============================================================================
// Domain Matching
// =============================================================================

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

// =============================================================================
// DOM Helpers
// =============================================================================

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
  'SELECT', 'OPTION', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED'
]);

function shouldSkipElement(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true;
  if ((element as HTMLElement).isContentEditable) return true;
  return false;
}

// =============================================================================
// Highlighting - Apply all matches at once (no recursion!)
// =============================================================================

// Exported for testing
export function highlightTextNode(node: Text, phraseMap: PhraseMap): number {
  const text = node.textContent || '';
  if (text.trim() === '') return 0;

  const matches = findMatches(text, phraseMap);
  if (matches.length === 0) return 0;

  const parent = node.parentNode;
  if (!parent) return 0;

  // Apply matches in REVERSE order to avoid position shifting
  // This is much more efficient than recursive calls
  let highlightCount = 0;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    try {
      // Split at end position first
      const afterMatch = node.splitText(match.end);

      // Split at start position (node now contains text before match)
      const matchNode = node.splitText(match.start);

      // matchNode now contains exactly the matched text
      // afterMatch contains text after the match

      // Create highlight span
      const span = document.createElement('span');
      span.style.backgroundColor = match.bgColor;
      span.style.color = match.textColor;
      span.style.padding = '2px 4px';
      span.style.boxShadow = '1px 1px rgba(0, 0, 0, 0.2)';
      span.style.borderRadius = '3px';
      span.style.fontStyle = 'inherit';
      span.setAttribute('data-makeitpop', 'true');
      span.textContent = matchNode.textContent;

      // Replace matchNode with the span
      parent.replaceChild(span, matchNode);

      highlightCount++;
    } catch (e) {
      // Node was modified during operation - skip this match
      continue;
    }
  }

  return highlightCount;
}

// Exported for testing
export function collectTextNodes(root: Node): Text[] {
  const textNodes: Text[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentNode;
      if (parent && parent.nodeType === Node.ELEMENT_NODE) {
        const element = parent as Element;
        // Skip if already highlighted or in skip element
        if (!element.hasAttribute('data-makeitpop') && !shouldSkipElement(element)) {
          textNodes.push(node as Text);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      // Skip highlighted spans and skip elements
      if (!element.hasAttribute('data-makeitpop') && !shouldSkipElement(element)) {
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
      }
    }
  }

  walk(root);
  return textNodes;
}

// Exported for testing
export function highlightNodes(nodes: Text[], phraseMap: PhraseMap): number {
  let totalHighlights = 0;
  for (const node of nodes) {
    // Check if node is still in DOM and parent hasn't been highlighted
    if (!node.parentNode) continue;
    const parent = node.parentNode as Element;
    if (parent.hasAttribute?.('data-makeitpop')) continue;

    totalHighlights += highlightTextNode(node, phraseMap);
  }
  return totalHighlights;
}

function clearAllHighlights(): number {
  const highlights = document.querySelectorAll('[data-makeitpop]');
  const count = highlights.length;

  highlights.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      const textNode = document.createTextNode(span.textContent || '');
      parent.replaceChild(textNode, span);
      parent.normalize();
    }
  });

  return count;
}

// =============================================================================
// Main Highlighting Logic
// =============================================================================

let currentPhraseMap: PhraseMap | null = null;
let mutationObserver: MutationObserver | null = null;

async function getActiveConfig(): Promise<{ phraseMap: PhraseMap; mode: 'light' | 'dark' } | null> {
  // Check if extension is enabled
  const enabled = await getEnabled();
  if (!enabled) {
    debugLog('Extension disabled');
    return null;
  }

  const hostname = window.location.hostname;
  const domains = await getDomains();
  const matchedDomain = domains.find(d => matchesDomain(d, hostname));

  if (!matchedDomain) {
    debugLog('No domain config for', hostname);
    return null;
  }

  const allGroups = await getGroups();
  let activeGroups = allGroups.filter(g => g.enabled);

  // Apply domain filters
  if (matchedDomain.groups !== undefined && matchedDomain.groupMode) {
    if (matchedDomain.groupMode === 'only') {
      activeGroups = activeGroups.filter(g => matchedDomain.groups!.includes(g.name));
    } else if (matchedDomain.groupMode === 'except') {
      activeGroups = activeGroups.filter(g => !matchedDomain.groups!.includes(g.name));
    }
  }

  if (activeGroups.length === 0) {
    debugLog('No active groups');
    return null;
  }

  // Build phrase map
  const mode = matchedDomain.mode;
  const phraseMap: PhraseMap = new Map();

  for (const group of activeGroups) {
    const bgColor = mode === 'dark' ? group.darkBgColor : group.lightBgColor;
    const textColor = mode === 'dark' ? group.darkTextColor : group.lightTextColor;

    for (const phrase of group.phrases) {
      phraseMap.set(phrase, { bgColor, textColor });
    }
  }

  debugLog('Active config', {
    domain: matchedDomain.domain,
    mode,
    groups: activeGroups.map(g => g.name),
    phrases: phraseMap.size
  });

  return { phraseMap, mode };
}

async function highlightPage() {
  const startTime = performance.now();
  debugLog('Highlighting page...');

  const config = await getActiveConfig();
  if (!config) {
    clearAllHighlights();
    currentPhraseMap = null;
    return;
  }

  currentPhraseMap = config.phraseMap;

  const textNodes = collectTextNodes(document.body);
  const highlightCount = highlightNodes(textNodes, config.phraseMap);

  const duration = performance.now() - startTime;
  debugLog(`Highlighted ${highlightCount} matches in ${duration.toFixed(0)}ms`, {
    textNodes: textNodes.length,
    phrases: config.phraseMap.size
  });
}

async function reHighlightPage() {
  debugLog('Re-highlighting page...');
  const cleared = clearAllHighlights();
  debugLog(`Cleared ${cleared} highlights`);

  // Clear matcher cache so it rebuilds with new settings
  clearMatcherCache();

  await highlightPage();
}

// =============================================================================
// MutationObserver - Only highlight NEW content
// =============================================================================

function startObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutations) => {
    if (!currentPhraseMap) return;

    // Collect only ADDED nodes that we should process
    const addedNodes: Node[] = [];

    for (const mutation of mutations) {
      // Only care about added nodes
      if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;

      for (const node of mutation.addedNodes) {
        // Skip our own highlights
        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((node as Element).hasAttribute('data-makeitpop')) continue;
        }

        // Skip text nodes in skip elements
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentNode as Element;
          if (!parent || shouldSkipElement(parent)) continue;
          if (parent.hasAttribute?.('data-makeitpop')) continue;
        }

        addedNodes.push(node);
      }
    }

    if (addedNodes.length === 0) return;

    // Collect text nodes from added content
    const textNodes: Text[] = [];
    for (const node of addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        textNodes.push(...collectTextNodes(node));
      }
    }

    if (textNodes.length === 0) return;

    debugLog(`MutationObserver: Processing ${textNodes.length} new text nodes`);
    const count = highlightNodes(textNodes, currentPhraseMap);
    if (count > 0) {
      debugLog(`MutationObserver: Added ${count} highlights`);
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
    // Note: NOT watching characterData - we don't care about typing
  });

  debugLog('MutationObserver started');
}

function stopObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
    debugLog('MutationObserver stopped');
  }
}

// =============================================================================
// Storage Change Listener - Re-highlight when settings change
// =============================================================================

let reHighlightTimeout: number | undefined;

onStorageChanged((changes) => {
  // Skip debug mode only changes
  if (changes.debugMode && Object.keys(changes).length === 1) return;

  if (changes.groups || changes.domains || changes.enabled) {
    debugLog('Settings changed, scheduling re-highlight', {
      changed: Object.keys(changes).filter(k => k !== 'debugMode')
    });

    // Debounce re-highlighting
    clearTimeout(reHighlightTimeout);
    reHighlightTimeout = window.setTimeout(() => {
      reHighlightPage();
    }, 300);
  }
});

// =============================================================================
// Initialization
// =============================================================================

function init() {
  // Wait for page to be ready
  if (document.readyState === 'complete') {
    setTimeout(() => {
      highlightPage().then(() => startObserver());
    }, 500);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        highlightPage().then(() => startObserver());
      }, 500);
    });
  }
}

init();
