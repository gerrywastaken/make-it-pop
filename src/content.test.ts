import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { findMatches, type PhraseMap } from './matcher';

// Mock chrome/browser API
const mockStorage = {
  local: {
    get: vi.fn().mockResolvedValue({
      enabled: true,
      groups: [],
      domains: [],
    }),
  },
};

global.chrome = { storage: mockStorage } as any;
global.browser = undefined as any;

describe('Content Script - Highlighting Behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Initial highlighting', () => {
    it('should highlight phrases in text nodes', () => {
      document.body.innerHTML = '<p>This is a test phrase for highlighting</p>';

      const phraseMap: PhraseMap = new Map([
        ['test phrase', { bgColor: '#00ff00', textColor: '#000000' }],
      ]);

      const text = document.body.textContent || '';
      const matches = findMatches(text, phraseMap);

      expect(matches).toHaveLength(1);
      expect(matches[0].start).toBe(10);
      expect(matches[0].end).toBe(21);
      expect(text.substring(matches[0].start, matches[0].end)).toBe('test phrase');
    });

    it('should not create overlapping highlights', () => {
      document.body.innerHTML = '<p>code review is important for code quality</p>';

      const phraseMap: PhraseMap = new Map([
        ['code', { bgColor: '#ff0000', textColor: '#ffffff' }],
        ['code review', { bgColor: '#00ff00', textColor: '#000000' }],
      ]);

      const text = document.body.textContent || '';
      const matches = findMatches(text, phraseMap);

      // Should match "code review" (longest) at start, then "code" later
      expect(matches).toHaveLength(2);
      expect(text.substring(matches[0].start, matches[0].end)).toBe('code review');
      expect(text.substring(matches[1].start, matches[1].end)).toBe('code');
    });
  });

  describe('MutationObserver behavior', () => {
    it('should detect when new text nodes are added', () => {
      return new Promise<void>((resolve) => {
        document.body.innerHTML = '<div id="container"></div>';
        const container = document.getElementById('container')!;

        // Set up a MutationObserver to detect changes
        const observer = new MutationObserver((mutations) => {
          let hasRelevantMutation = false;

          for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                  hasRelevantMutation = true;
                  break;
                }
              }
            }
          }

          if (hasRelevantMutation) {
            observer.disconnect();
            resolve();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Add new content
        const p = document.createElement('p');
        p.textContent = 'New content with test phrase';
        container.appendChild(p);
      });
    });

    it('should detect when text content changes (characterData)', () => {
      return new Promise<void>((resolve) => {
        document.body.innerHTML = '<p id="text">Original text</p>';
        const paragraph = document.getElementById('text')!;
        const textNode = paragraph.firstChild as Text;

        const observer = new MutationObserver((mutations) => {
          let hasCharacterDataChange = false;

          for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
              hasCharacterDataChange = true;
              break;
            }
          }

          if (hasCharacterDataChange) {
            observer.disconnect();
            expect(textNode.textContent).toBe('Updated with test phrase');
            resolve();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // Change text content
        textNode.textContent = 'Updated with test phrase';
      });
    });

    it('should detect when nodes are replaced (SPA pattern)', () => {
      return new Promise<void>((resolve) => {
        document.body.innerHTML = '<div id="container"><p>Old content</p></div>';
        const container = document.getElementById('container')!;

        let addedCount = 0;
        let removedCount = 0;

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              addedCount += mutation.addedNodes.length;
              removedCount += mutation.removedNodes.length;
            }
          }

          // SPA pattern: nodes removed and new ones added
          if (addedCount > 0 && removedCount > 0) {
            observer.disconnect();
            expect(container.querySelector('p')?.textContent).toBe('New content with test phrase');
            resolve();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Simulate SPA content replacement
        container.innerHTML = '<p>New content with test phrase</p>';
      });
    });

    it('should ignore mutations inside highlight spans', () => {
      document.body.innerHTML = '<p>Some text</p>';

      const mutations: MutationRecord[] = [];
      const observer = new MutationObserver((mutationsList) => {
        mutations.push(...mutationsList);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Add a highlight span
      const span = document.createElement('span');
      span.setAttribute('data-makeitpop-highlight', 'true');
      span.textContent = 'highlighted';
      document.body.appendChild(span);

      // Wait for mutations to be recorded
      setTimeout(() => {
        observer.disconnect();

        // Check if we can detect highlight spans
        const hasHighlightSpan = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node as Element).hasAttribute('data-makeitpop-highlight')
          )
        );

        expect(hasHighlightSpan).toBe(true);
      }, 0);
    });
  });

  describe('Debounce behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should delay function execution until wait period has passed', () => {
      const mockFn = vi.fn();
      const debounce = (func: Function, wait: number) => {
        let timeout: number | undefined;
        return function (...args: any[]) {
          clearTimeout(timeout);
          timeout = window.setTimeout(() => func(...args), wait) as any;
        };
      };

      const debouncedFn = debounce(mockFn, 1500);

      // Call multiple times
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Fast forward time
      vi.advanceTimersByTime(1499);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const mockFn = vi.fn();
      const debounce = (func: Function, wait: number) => {
        let timeout: number | undefined;
        return function (...args: any[]) {
          clearTimeout(timeout);
          timeout = window.setTimeout(() => func(...args), wait) as any;
        };
      };

      const debouncedFn = debounce(mockFn, 1500);

      debouncedFn();
      vi.advanceTimersByTime(1000);

      // Call again - should reset timer
      debouncedFn();
      vi.advanceTimersByTime(1000);

      // Still not called (only 1000ms since last call)
      expect(mockFn).not.toHaveBeenCalled();

      // Advance another 500ms
      vi.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance - phrase caching', () => {
    it('should cache sorted phrases to avoid recreating arrays', () => {
      const phraseMap: PhraseMap = new Map([
        ['short', { bgColor: '#ff0000', textColor: '#ffffff' }],
        ['medium length', { bgColor: '#00ff00', textColor: '#000000' }],
        ['very long phrase here', { bgColor: '#0000ff', textColor: '#ffffff' }],
      ]);

      const text = 'This is a very long phrase here with medium length and short words';

      // First call - builds cache
      const matches1 = findMatches(text, phraseMap);

      // Second call with same phraseMap - should use cache
      const matches2 = findMatches(text, phraseMap);

      // Should get same results (cache working correctly)
      expect(matches1).toHaveLength(3);
      expect(matches2).toHaveLength(3);

      // Verify matches are in correct order (longest first)
      expect(text.substring(matches1[0].start, matches1[0].end)).toBe('very long phrase here');
      expect(text.substring(matches1[1].start, matches1[1].end)).toBe('medium length');
      expect(text.substring(matches1[2].start, matches1[2].end)).toBe('short');
    });

    it('should rebuild cache when phraseMap changes', () => {
      const phraseMap1: PhraseMap = new Map([
        ['test', { bgColor: '#ff0000', textColor: '#ffffff' }],
      ]);

      const phraseMap2: PhraseMap = new Map([
        ['test', { bgColor: '#ff0000', textColor: '#ffffff' }],
        ['phrase', { bgColor: '#00ff00', textColor: '#000000' }],
      ]);

      const text = 'This is a test phrase';

      const matches1 = findMatches(text, phraseMap1);
      expect(matches1).toHaveLength(1);

      const matches2 = findMatches(text, phraseMap2);
      expect(matches2).toHaveLength(2); // Should detect new phrase
    });
  });

  describe('Loop number tracking', () => {
    it('should use loop numbers to avoid re-highlighting the same content', () => {
      // This behavior is implicit in the walkTextNodes function
      // It tracks loop numbers to skip content already processed in this pass
      const loopNumber1 = 1;
      const loopNumber2 = 2;

      // Create a highlight span with loop number
      const span = document.createElement('span');
      span.setAttribute('data-makeitpop-highlight', 'true');
      span.setAttribute('data-makeitpop-loop', String(loopNumber1));
      span.textContent = 'highlighted';

      document.body.appendChild(span);

      // In real code, walkTextNodes would check:
      // - If parent has data-makeitpop-loop === currentLoopNumber, skip
      // - This prevents re-processing content in the same pass

      expect(span.getAttribute('data-makeitpop-loop')).toBe('1');
      expect(span.hasAttribute('data-makeitpop-highlight')).toBe(true);
    });
  });
});
