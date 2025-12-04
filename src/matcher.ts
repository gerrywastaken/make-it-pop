// Phrase matching using Aho-Corasick algorithm for O(n) multi-pattern matching
// This replaces the naive O(n × m) approach with a single-pass algorithm

export interface PhraseColors {
  bgColor: string;
  textColor: string;
}

export type PhraseMap = Map<string, PhraseColors>;

export interface Match {
  start: number;
  end: number;
  phrase: string;  // Original phrase (for case preservation)
  bgColor: string;
  textColor: string;
}

// Check if a character is a word character (alphanumeric or underscore)
function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

// Check if match is at a word boundary
function isWordBoundary(text: string, start: number, end: number, phrase: string): boolean {
  const charBefore = start > 0 ? text[start - 1] : '';
  const charAfter = end < text.length ? text[end] : '';

  // Only check start boundary if phrase starts with a word character
  const phraseStartsWithWord = isWordChar(phrase[0]);
  const beforeOk = !phraseStartsWithWord || start === 0 || !isWordChar(charBefore);

  // Only check end boundary if phrase ends with a word character
  const phraseEndsWithWord = isWordChar(phrase[phrase.length - 1]);
  const afterOk = !phraseEndsWithWord || end === text.length || !isWordChar(charAfter);

  return beforeOk && afterOk;
}

// Check if a phrase is all uppercase
function isAllUppercase(phrase: string): boolean {
  const letters = phrase.match(/[a-zA-Z]/g);
  if (!letters || letters.length === 0) return false;
  return letters.every(char => char === char.toUpperCase());
}

// Aho-Corasick Trie Node
interface TrieNode {
  children: Map<string, TrieNode>;
  fail: TrieNode | null;  // Failure link
  output: PhraseOutput[]; // Patterns that end at this node
  depth: number;
}

interface PhraseOutput {
  phrase: string;         // Original phrase
  lowerPhrase: string;    // Lowercase version for matching
  caseSensitive: boolean; // True for all-uppercase phrases
  colors: PhraseColors;
}

function createNode(depth: number = 0): TrieNode {
  return {
    children: new Map(),
    fail: null,
    output: [],
    depth
  };
}

// Build Aho-Corasick automaton from phrase map
class AhoCorasick {
  private root: TrieNode;
  private built: boolean = false;

  constructor() {
    this.root = createNode();
  }

  // Add a phrase to the trie
  addPhrase(phrase: string, colors: PhraseColors): void {
    const lowerPhrase = phrase.toLowerCase();
    const caseSensitive = isAllUppercase(phrase);

    let node = this.root;
    for (const char of lowerPhrase) {
      if (!node.children.has(char)) {
        node.children.set(char, createNode(node.depth + 1));
      }
      node = node.children.get(char)!;
    }

    node.output.push({ phrase, lowerPhrase, caseSensitive, colors });
    this.built = false;
  }

  // Build failure links using BFS
  build(): void {
    if (this.built) return;

    const queue: TrieNode[] = [];

    // Initialize failure links for depth-1 nodes to root
    for (const child of this.root.children.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    // BFS to build failure links
    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [char, child] of current.children) {
        queue.push(child);

        // Find failure link
        let fail = current.fail;
        while (fail !== null && !fail.children.has(char)) {
          fail = fail.fail;
        }
        child.fail = fail ? fail.children.get(char)! : this.root;

        // Merge output from failure link (for overlapping patterns)
        if (child.fail !== this.root) {
          child.output = [...child.output, ...child.fail.output];
        }
      }
    }

    this.built = true;
  }

  // Search for all matches in text - O(n) where n is text length
  search(text: string): Match[] {
    this.build();

    const lowerText = text.toLowerCase();
    const matches: Match[] = [];
    let node = this.root;

    for (let i = 0; i < lowerText.length; i++) {
      const char = lowerText[i];

      // Follow failure links until we find a match or reach root
      while (node !== this.root && !node.children.has(char)) {
        node = node.fail!;
      }

      if (node.children.has(char)) {
        node = node.children.get(char)!;
      }

      // Check for matches at this position
      for (const output of node.output) {
        const start = i - output.lowerPhrase.length + 1;
        const end = i + 1;

        // Check word boundaries
        if (!isWordBoundary(text, start, end, output.phrase)) {
          continue;
        }

        // For case-sensitive phrases, verify exact match
        if (output.caseSensitive) {
          const actualText = text.substring(start, end);
          if (actualText !== output.phrase) {
            continue;
          }
        }

        matches.push({
          start,
          end,
          phrase: output.phrase,
          bgColor: output.colors.bgColor,
          textColor: output.colors.textColor
        });
      }
    }

    // Sort by position, then by length (longest first for overlaps)
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end; // Longer matches first
    });

    // Remove overlapping matches (keep longest/first)
    const filtered: Match[] = [];
    let lastEnd = 0;
    for (const match of matches) {
      if (match.start >= lastEnd) {
        filtered.push(match);
        lastEnd = match.end;
      }
    }

    return filtered;
  }
}

// Cache the automaton to avoid rebuilding
let cachedAutomaton: AhoCorasick | null = null;
let cachedPhraseMap: PhraseMap | null = null;

export function findMatches(text: string, phraseMap: PhraseMap): Match[] {
  // Rebuild automaton if phrase map changed
  if (phraseMap !== cachedPhraseMap) {
    cachedAutomaton = new AhoCorasick();
    for (const [phrase, colors] of phraseMap) {
      cachedAutomaton.addPhrase(phrase, colors);
    }
    cachedAutomaton.build();
    cachedPhraseMap = phraseMap;
  }

  if (!cachedAutomaton) return [];

  return cachedAutomaton.search(text);
}

// Clear the cache (useful when settings change)
export function clearMatcherCache(): void {
  cachedAutomaton = null;
  cachedPhraseMap = null;
}
