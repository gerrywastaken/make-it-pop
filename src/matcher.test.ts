import { describe, it, expect } from 'vitest';
import { findMatches, type PhraseMap, type Match } from './matcher';

const GREEN = { bgColor: '#00ff00', textColor: '#000000' };
const BLUE = { bgColor: '#0000ff', textColor: '#ffffff' };
const RED = { bgColor: '#ff0000', textColor: '#ffffff' };

const textOf = (text: string, match: Match) => text.substring(match.start, match.end);

const textAndColorPairs = (text: string, matches: Match[]) =>
  matches.map(m => ({
    text: textOf(text, m),
    color: { bgColor: m.bgColor, textColor: m.textColor }
  }));

describe('Phrase Matching - Longest Match Wins', () => {
  it('should match "Remote (US)" instead of separate "Remote" and "US" phrases', () => {
    // Input: Three phrases with different colors
    const phraseMap: PhraseMap = new Map([
      ['remote', GREEN],
      ['US', BLUE],
      ['Remote (US)', RED],
    ]);
    const text = 'London, England, GB / Remote (US) - fulltime';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Only ONE match for the longest phrase "Remote (US)" in red
    expect(matches.length).toBe(1);
    expect(textOf(text, matches[0])).toBe('Remote (US)');
    expect(matches[0].bgColor).toBe(RED.bgColor);
  });

  it('should prioritize longest matches when multiple phrases could match', () => {
    // Input: Three overlapping phrases, multiple occurrences in text
    const phraseMap: PhraseMap = new Map([
      ['remote', GREEN],
      ['US', BLUE],
      ['Remote (US)', RED],
    ]);
    const text = 'Remote (US) position, also remote work in US available';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Three matches - compound phrase first, then individual phrases
    expect(textAndColorPairs(text, matches)).toEqual([
      { text: 'Remote (US)', color: RED },
      { text: 'remote', color: GREEN },
      { text: 'US', color: BLUE },
    ]);
  });

  it('should use case-sensitive matching for all-uppercase phrases', () => {
    // Input: All-uppercase phrase "US"
    const phraseMap: PhraseMap = new Map([
      ['US', BLUE],
    ]);

    // Run & Expect: Should match uppercase "US"
    const matches1 = findMatches('Located in US', phraseMap);
    expect(matches1.length).toBe(1);
    expect(matches1[0].bgColor).toBe(BLUE.bgColor);

    // Run & Expect: Should NOT match lowercase "us"
    const matches2 = findMatches('Tell us more', phraseMap);
    expect(matches2.length).toBe(0);
  });

  it('should use case-insensitive matching for mixed-case phrases', () => {
    // Input: Mixed-case phrase "Remote"
    const phraseMap: PhraseMap = new Map([
      ['Remote', GREEN],
    ]);

    // Run & Expect: Should match "remote" in lowercase text
    const matches = findMatches('Looking for remote work', phraseMap);
    expect(matches.length).toBe(1);
    expect(matches[0].bgColor).toBe(GREEN.bgColor);
  });

  it('should handle phrases with special characters and word boundaries', () => {
    // Input: Phrase with parentheses
    const phraseMap: PhraseMap = new Map([
      ['Remote (US)', RED],
    ]);

    // Run: Find in various contexts
    const contexts = [
      'Remote (US) only',           // At start
      'Position: Remote (US)',      // At end
      'Apply for Remote (US) role', // In middle
    ];

    // Expect: Should match in all contexts
    contexts.forEach(text => {
      const matches = findMatches(text, phraseMap);
      expect(matches.length).toBe(1);
      expect(textOf(text, matches[0])).toBe('Remote (US)');
    });
  });

  it('should not create overlapping matches', () => {
    // Input: Overlapping phrases "code" and "code review"
    const phraseMap: PhraseMap = new Map([
      ['code', GREEN],
      ['code review', RED],
    ]);
    const text = 'Please do a code review';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Only "code review" matches (longest wins), not "code" separately
    expect(matches.length).toBe(1);
    expect(textOf(text, matches[0])).toBe('code review');
    expect(matches[0].bgColor).toBe(RED.bgColor);
  });
});
