import { describe, it, expect } from 'vitest';
import { findMatches, type PhraseMap } from './matcher';

describe('Phrase Matching - Longest Match Wins', () => {
  it('should match "Remote (US)" instead of separate "Remote" and "US" phrases', () => {
    // Input: Three phrases with different colors
    const phraseMap: PhraseMap = new Map([
      ['remote', { bgColor: '#00ff00', textColor: '#000000' }],        // green
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],            // blue
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],   // red
    ]);
    const text = 'London, England, GB / Remote (US) - fulltime';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Only ONE match for the longest phrase "Remote (US)" in red
    expect(matches.length).toBe(1);
    expect(text.substring(matches[0].start, matches[0].end)).toBe('Remote (US)');
    expect(matches[0].bgColor).toBe('#ff0000');
  });

  it('should prioritize longest matches when multiple phrases could match', () => {
    // Input: Three overlapping phrases, multiple occurrences in text
    const phraseMap: PhraseMap = new Map([
      ['remote', { bgColor: '#00ff00', textColor: '#000000' }],
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],
    ]);
    const text = 'Remote (US) position, also remote work in US available';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Three matches - compound phrase first, then individual phrases
    expect(matches.length).toBe(3);
    expect(text.substring(matches[0].start, matches[0].end)).toBe('Remote (US)');
    expect(matches[0].bgColor).toBe('#ff0000');
    expect(text.substring(matches[1].start, matches[1].end)).toBe('remote');
    expect(matches[1].bgColor).toBe('#00ff00');
    expect(text.substring(matches[2].start, matches[2].end)).toBe('US');
    expect(matches[2].bgColor).toBe('#0000ff');
  });

  it('should use case-sensitive matching for all-uppercase phrases', () => {
    // Input: All-uppercase phrase "US"
    const phraseMap: PhraseMap = new Map([
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],
    ]);

    // Run & Expect: Should match uppercase "US"
    const matches1 = findMatches('Located in US', phraseMap);
    expect(matches1.length).toBe(1);
    expect(matches1[0].bgColor).toBe('#0000ff');

    // Run & Expect: Should NOT match lowercase "us"
    const matches2 = findMatches('Tell us more', phraseMap);
    expect(matches2.length).toBe(0);
  });

  it('should use case-insensitive matching for mixed-case phrases', () => {
    // Input: Mixed-case phrase "Remote"
    const phraseMap: PhraseMap = new Map([
      ['Remote', { bgColor: '#00ff00', textColor: '#000000' }],
    ]);

    // Run & Expect: Should match "remote" in lowercase text
    const matches = findMatches('Looking for remote work', phraseMap);
    expect(matches.length).toBe(1);
    expect(matches[0].bgColor).toBe('#00ff00');
  });

  it('should handle phrases with special characters and word boundaries', () => {
    // Input: Phrase with parentheses
    const phraseMap: PhraseMap = new Map([
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],
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
      expect(text.substring(matches[0].start, matches[0].end)).toBe('Remote (US)');
    });
  });

  it('should not create overlapping matches', () => {
    // Input: Overlapping phrases "code" and "code review"
    const phraseMap: PhraseMap = new Map([
      ['code', { bgColor: '#00ff00', textColor: '#000000' }],
      ['code review', { bgColor: '#ff0000', textColor: '#ffffff' }],
    ]);
    const text = 'Please do a code review';

    // Run: Find matches
    const matches = findMatches(text, phraseMap);

    // Expect: Only "code review" matches (longest wins), not "code" separately
    expect(matches.length).toBe(1);
    expect(text.substring(matches[0].start, matches[0].end)).toBe('code review');
    expect(matches[0].bgColor).toBe('#ff0000');
  });
});
