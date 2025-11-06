// Inline types to avoid imports
interface Group {
  id: string;
  name: string;
  lightBgColor: string;
  lightTextColor: string;
  darkBgColor: string;
  darkTextColor: string;
  phrases: string[];
}

interface Domain {
  id: string;
  pattern: string;
  mode: 'light' | 'dark';
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
  bgColor: string;
  textColor: string;
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

function findMatches(text: string, phraseMap: Map<string, {bgColor: string, textColor: string}>): Match[] {
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
          const colors = phraseMap.get(phrase)!;
          matches.push({
            start: position,
            end: end,
            bgColor: colors.bgColor,
            textColor: colors.textColor,
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

function highlightTextNode(node: Text, phraseMap: Map<string, {bgColor: string, textColor: string}>) {
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
    span.style.backgroundColor = match.bgColor;
    span.style.color = match.textColor;
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

// Elements we should never highlight inside
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
  'SELECT', 'OPTION', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED'
]);

function isReactManaged(element: Element): boolean {
  // Check for React fiber properties (React 16+)
  const keys = Object.keys(element);
  for (const key of keys) {
    if (key.startsWith('__reactFiber') ||
        key.startsWith('__reactProps') ||
        key.startsWith('__reactInternalInstance')) {
      return true;
    }
  }

  // Check for common React root markers
  if (element.id === 'root' ||
      element.id === 'app' ||
      element.id === '__next' ||
      element.hasAttribute('data-reactroot')) {
    return true;
  }

  return false;
}

function isWithinReactTree(node: Node): boolean {
  let current: Node | null = node;

  // Walk up the tree checking each element
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      if (isReactManaged(element)) {
        return true;
      }
    }
    current = current.parentNode;
  }

  return false;
}

function shouldSkipElement(element: Element): boolean {
  // Skip if it's one of the forbidden tags
  if (SKIP_TAGS.has(element.tagName)) {
    return true;
  }
  // Skip contenteditable elements (rich text editors)
  if (element.isContentEditable) {
    return true;
  }

  // Skip if this element or any parent is React-managed
  if (isWithinReactTree(element)) {
    return true;
  }

  return false;
}

function walkTextNodes(node: Node, phraseMap: Map<string, {bgColor: string, textColor: string}>) {
  // Skip if this node or its parent is already a highlight span
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentNode;
    if (!parent) return;

    // Skip if within React tree
    if (isWithinReactTree(node)) {
      return;
    }

    // Skip if parent is a forbidden element
    if (parent.nodeType === Node.ELEMENT_NODE && shouldSkipElement(parent as Element)) {
      return;
    }

    if ((parent as Element).hasAttribute?.('data-makeitpop-highlight')) {
      return; // Already highlighted
    }
    highlightTextNode(node as Text, phraseMap);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;

    // Skip our own highlight spans
    if (element.hasAttribute('data-makeitpop-highlight')) {
      return;
    }

    // Skip forbidden elements entirely
    if (shouldSkipElement(element)) {
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

let globalPhraseMap: Map<string, {bgColor: string, textColor: string}> | null = null;

function highlightNewContent() {
  if (!globalPhraseMap) return;
  walkTextNodes(document.body, globalPhraseMap);
}

const debouncedHighlight = debounce(highlightNewContent, 3000);

async function highlightPage() {
  // Check if extension is enabled
  const enabledData = await browserAPI.storage.local.get('enabled');
  const enabled = enabledData.enabled !== false; // Default to true if not set
  if (!enabled) return;

  const hostname = window.location.hostname;
  const domains = await getDomains();

  const matchedDomain = domains.find(d => matchesDomain(d.pattern, hostname));
  if (!matchedDomain || matchedDomain.groupIds.length === 0) return;

  const groups = await getGroups();
  const activeGroups = groups.filter(g => matchedDomain.groupIds.includes(g.id));

  const mode = matchedDomain.mode;
  const phraseMap = new Map<string, {bgColor: string, textColor: string}>();

  for (const group of activeGroups) {
    const bgColor = mode === 'dark' ? group.darkBgColor : group.lightBgColor;
    const textColor = mode === 'dark' ? group.darkTextColor : group.lightTextColor;

    for (const phrase of group.phrases) {
      phraseMap.set(phrase, { bgColor, textColor });
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
