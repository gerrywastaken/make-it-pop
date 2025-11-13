import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Highlighter } from './content';
import type { PhraseMap } from './matcher';

const GREEN = { bgColor: '#00ff00', textColor: '#000000' };
const RED = { bgColor: '#ff0000', textColor: '#ffffff' };

const highlightedTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-makeitpop-highlight]'))
    .map(span => span.textContent || '');

describe('Content Script - SPA Highlighting', () => {
  let container: HTMLElement;
  let highlighter: Highlighter;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    highlighter?.stop();
    container.remove();
    vi.restoreAllMocks();
  });

  it('should highlight phrases when SPA replaces content', async () => {
    const phraseMap: PhraseMap = new Map([
      ['test phrase', GREEN],
      ['important', RED],
    ]);

    highlighter = new Highlighter(container, 100); // Short debounce for testing
    highlighter.setPhrases(phraseMap, 'light');

    // Start with content that has no matching phrases
    container.innerHTML = '<div id="app"><p>Original content here</p></div>';
    highlighter.start();

    expect(highlightedTexts(container)).toEqual([]);

    // Simulate SPA navigation: replace content (like LinkedIn side panel)
    const app = container.querySelector('#app')!;
    app.innerHTML = '<p>New content with test phrase and important info</p>';

    // Immediately after change - no highlights yet (debounced)
    expect(highlightedTexts(container)).toEqual([]);

    // Need to wait for MutationObserver to fire (it's async)
    await vi.waitFor(() => {}, { timeout: 10 });

    // Fast-forward past debounce period
    await vi.advanceTimersByTimeAsync(150);

    expect(highlightedTexts(container)).toEqual(['test phrase', 'important']);
  });
});
