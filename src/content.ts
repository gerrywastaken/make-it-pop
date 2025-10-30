// Inline types to avoid imports
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

// Inline storage functions to avoid code splitting issues
async function getGroups(): Promise<Group[]> {
  const data = await browserAPI.storage.local.get('groups');
  return data.groups || [];
}

async function getDomains(): Promise<Domain[]> {
  const data = await browserAPI.storage.local.get('domains');
  return data.domains || [];
}

function matchesDomain(pattern: string, hostname: string): boolean {
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.slice(2);
    return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
  }
  return pattern === hostname;
}

interface Match {
  start: number;
  end: number;
  color: string;
}

// Check if a character is a word character (alphanumeric or underscore)
function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

// Check if match is at a word boundary
function isWordBoundary(text: string, start: number, end: number): boolean {
  const charBefore = start > 0 ? text[start - 1] : '';
  const charAfter = end < text.length ? text[end] : '';

  const beforeOk = start === 0 || !isWordChar(charBefore);
  const afterOk = end === text.length || !isWordChar(charAfter);

  return beforeOk && afterOk;
}

function findMatches(text: string, phraseMap: Map<string, string>): Match[] {
  const phrases = Array.from(phraseMap.keys()).sort((a, b) => b.length - a.length);
  const matches: Match[] = [];
  const lowerText = text.toLowerCase();

  let position = 0;
  while (position < text.length) {
    let matched = false;
    for (const phrase of phrases) {
      const lowerPhrase = phrase.toLowerCase();
      if (lowerText.startsWith(lowerPhrase, position)) {
        const end = position + phrase.length;
        // Check word boundaries
        if (isWordBoundary(text, position, end)) {
          matches.push({
            start: position,
            end: end,
            color: phraseMap.get(phrase)!,
          });
          position += phrase.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) position++;
  }

  return matches;
}

function highlightTextNode(node: Text, phraseMap: Map<string, string>) {
  const text = node.textContent || '';
  const matches = findMatches(text, phraseMap);

  if (matches.length === 0) return;

  const parent = node.parentNode;
  if (!parent) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of matches) {
    if (match.start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
    }

    const span = document.createElement('span');
    span.style.backgroundColor = match.color;
    span.setAttribute('data-makeitpop-highlight', 'true');
    span.textContent = text.slice(match.start, match.end);
    fragment.appendChild(span);

    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(fragment, node);
}

function walkTextNodes(node: Node, phraseMap: Map<string, string>) {
  // Skip if this node or its parent is already a highlight span
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (parent && (parent as Element).hasAttribute?.('data-makeitpop-highlight')) {
      return; // Already highlighted
    }
    highlightTextNode(node as Text, phraseMap);
  } else {
    // Skip our own highlight spans
    if ((node as Element).hasAttribute?.('data-makeitpop-highlight')) {
      return;
    }
    const children = Array.from(node.childNodes);
    for (const child of children) {
      walkTextNodes(child, phraseMap);
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

let globalPhraseMap: Map<string, string> | null = null;

function highlightNewContent() {
  if (!globalPhraseMap) return;
  walkTextNodes(document.body, globalPhraseMap);
}

const debouncedHighlight = debounce(highlightNewContent, 3000);

async function highlightPage() {
  const hostname = window.location.hostname;
  const domains = await getDomains();

  const matchedDomain = domains.find(d => matchesDomain(d.pattern, hostname));
  if (!matchedDomain || matchedDomain.groupIds.length === 0) return;

  const groups = await getGroups();
  const activeGroups = groups.filter(g => matchedDomain.groupIds.includes(g.id));

  const phraseMap = new Map<string, string>();
  for (const group of activeGroups) {
    for (const phrase of group.phrases) {
      phraseMap.set(phrase, group.color);
    }
  }

  globalPhraseMap = phraseMap;

  // Initial highlight
  walkTextNodes(document.body, phraseMap);

  // Set up MutationObserver for dynamic content
  const observer = new MutationObserver((mutations) => {
    debouncedHighlight();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

highlightPage();
