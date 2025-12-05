import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectTextNodes, highlightNodes } from './content';
import type { PhraseMap } from './matcher';

const GREEN = { bgColor: '#00ff00', textColor: '#000000' };
const RED = { bgColor: '#ff0000', textColor: '#ffffff' };

const highlightedTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-makeitpop]'))
    .map(span => span.textContent || '');

describe('Content Script - Highlighting', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should highlight phrases in text content', () => {
    const phraseMap: PhraseMap = new Map([
      ['test phrase', GREEN],
      ['important', RED],
    ]);

    container.innerHTML = '<p>This has a test phrase and important info</p>';

    const textNodes = collectTextNodes(container);
    expect(textNodes.length).toBeGreaterThan(0);

    const count = highlightNodes(textNodes, phraseMap);
    expect(count).toBe(2);
    expect(highlightedTexts(container)).toEqual(['test phrase', 'important']);
  });

  it('should highlight new content when added dynamically', () => {
    const phraseMap: PhraseMap = new Map([
      ['test phrase', GREEN],
      ['important', RED],
    ]);

    // Start with content that has no matching phrases
    container.innerHTML = '<div id="app"><p>Original content here</p></div>';

    let textNodes = collectTextNodes(container);
    let count = highlightNodes(textNodes, phraseMap);
    expect(count).toBe(0);
    expect(highlightedTexts(container)).toEqual([]);

    // Simulate SPA navigation: replace content
    const app = container.querySelector('#app')!;
    app.innerHTML = '<p>New content with test phrase and important info</p>';

    // Highlight the new content
    textNodes = collectTextNodes(container);
    count = highlightNodes(textNodes, phraseMap);
    expect(count).toBe(2);
    expect(highlightedTexts(container)).toEqual(['test phrase', 'important']);
  });

  it('should skip already highlighted content', () => {
    const phraseMap: PhraseMap = new Map([
      ['test', GREEN],
    ]);

    container.innerHTML = '<p>test test test</p>';

    // First pass
    let textNodes = collectTextNodes(container);
    let count = highlightNodes(textNodes, phraseMap);
    expect(count).toBe(3);

    // Second pass should find no new text nodes to highlight
    textNodes = collectTextNodes(container);
    count = highlightNodes(textNodes, phraseMap);
    expect(count).toBe(0);
  });

  it('should skip textarea and input elements', () => {
    const phraseMap: PhraseMap = new Map([
      ['secret', RED],
    ]);

    container.innerHTML = `
      <p>secret in paragraph</p>
      <textarea>secret in textarea</textarea>
      <input value="secret in input">
    `;

    const textNodes = collectTextNodes(container);
    const count = highlightNodes(textNodes, phraseMap);

    // Only the paragraph should be highlighted
    expect(count).toBe(1);
    expect(highlightedTexts(container)).toEqual(['secret']);
  });
});
