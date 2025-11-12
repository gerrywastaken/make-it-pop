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
    const phraseMap: PhraseMap = new Map([
      ['remote', GREEN],
      ['US', BLUE],
      ['Remote (US)', RED],
    ]);
    const text = 'London, England, GB / Remote (US) - fulltime';

    const matches = findMatches(text, phraseMap);

    expect(textAndColorPairs(text, matches)).toEqual([
      { text: 'Remote (US)', color: RED },
    ]);
  });

  it('should match longest phrase regardless of map insertion order', () => {
    const phraseMap: PhraseMap = new Map([
      ['Remote (US)', RED],
      ['remote', GREEN],
      ['US', BLUE],
    ]);
    const text = 'London, England, GB / Remote (US) - fulltime';

    const matches = findMatches(text, phraseMap);

    expect(textAndColorPairs(text, matches)).toEqual([
      { text: 'Remote (US)', color: RED },
    ]);
  });

  it('should prioritize longest matches when multiple phrases could match', () => {
    const phraseMap: PhraseMap = new Map([
      ['remote', GREEN],
      ['US', BLUE],
      ['Remote (US)', RED],
    ]);
    const text = 'Remote (US) position, also remote work in US available';

    const matches = findMatches(text, phraseMap);

    expect(textAndColorPairs(text, matches)).toEqual([
      { text: 'Remote (US)', color: RED },
      { text: 'remote', color: GREEN },
      { text: 'US', color: BLUE },
    ]);
  });

  it('should use case-sensitive matching for all-uppercase phrases', () => {
    const phraseMap: PhraseMap = new Map([
      ['US', BLUE],
    ]);

    expect(textAndColorPairs('Located in US', findMatches('Located in US', phraseMap))).toEqual([
      { text: 'US', color: BLUE },
    ]);

    expect(findMatches('Tell us more', phraseMap)).toEqual([]);
  });

  it('should use case-insensitive matching for mixed-case phrases', () => {
    const phraseMap: PhraseMap = new Map([
      ['Remote', GREEN],
    ]);

    expect(textAndColorPairs('Looking for remote work', findMatches('Looking for remote work', phraseMap))).toEqual([
      { text: 'remote', color: GREEN },
    ]);
  });

  it('should handle phrases with special characters and word boundaries', () => {
    const phraseMap: PhraseMap = new Map([
      ['Remote (US)', RED],
    ]);

    const contexts = [
      'Remote (US) only',
      'Position: Remote (US)',
      'Apply for Remote (US) role',
    ];

    contexts.forEach(text => {
      expect(textAndColorPairs(text, findMatches(text, phraseMap))).toEqual([
        { text: 'Remote (US)', color: RED },
      ]);
    });
  });

  it('should not create overlapping matches', () => {
    const phraseMap: PhraseMap = new Map([
      ['code', GREEN],
      ['code review', RED],
    ]);
    const text = 'Please do a code review';

    const matches = findMatches(text, phraseMap);

    expect(textAndColorPairs(text, matches)).toEqual([
      { text: 'code review', color: RED },
    ]);
  });
});
