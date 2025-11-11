import { describe, it, expect } from 'vitest';

// Duplicated helper functions from content.ts for testing
// (In a real refactor, these would be extracted to a shared module)

function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

function isWordBoundary(text: string, start: number, end: number, phrase: string): boolean {
  const charBefore = start > 0 ? text[start - 1] : '';
  const charAfter = end < text.length ? text[end] : '';

  const phraseStartsWithWord = isWordChar(phrase[0]);
  const beforeOk = !phraseStartsWithWord || start === 0 || !isWordChar(charBefore);

  const phraseEndsWithWord = isWordChar(phrase[phrase.length - 1]);
  const afterOk = !phraseEndsWithWord || end === text.length || !isWordChar(charAfter);

  return beforeOk && afterOk;
}

function isAllUppercase(phrase: string): boolean {
  const letters = phrase.match(/[a-zA-Z]/g);
  if (!letters || letters.length === 0) return false;
  return letters.every(char => char === char.toUpperCase());
}

interface Match {
  start: number;
  end: number;
  bgColor: string;
  textColor: string;
}

function findMatches(text: string, phraseMap: Map<string, {bgColor: string, textColor: string}>): Match[] {
  const phrases = Array.from(phraseMap.keys()).sort((a, b) => b.length - a.length);
  const matches: Match[] = [];
  const lowerText = text.toLowerCase();

  let position = 0;
  while (position < text.length) {
    let matched = false;
    for (const phrase of phrases) {
      const isUppercasePhrase = isAllUppercase(phrase);
      let matchFound = false;

      if (isUppercasePhrase) {
        // Case-sensitive matching for all-uppercase phrases
        const substring = text.substring(position, position + phrase.length);
        matchFound = substring === phrase;
      } else {
        // Case-insensitive matching for mixed-case or lowercase phrases
        const lowerPhrase = phrase.toLowerCase();
        matchFound = lowerText.startsWith(lowerPhrase, position);
      }

      if (matchFound) {
        const end = position + phrase.length;
        // Check word boundaries
        if (isWordBoundary(text, position, end, phrase)) {
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

describe('Phrase Matching - Longest Match Wins', () => {
  it('should match "Remote (US)" instead of separate "Remote" and "US" phrases', () => {
    // Setup: Three phrases with different colors
    const phraseMap = new Map<string, {bgColor: string, textColor: string}>([
      ['remote', { bgColor: '#00ff00', textColor: '#000000' }],        // green
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],            // blue
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],   // red
    ]);

    // Test text from the user's example
    const text = 'London, England, GB / Remote (US) - fulltime';

    // Find matches
    const matches = findMatches(text, phraseMap);

    // Debug: log all matches to see what we got
    console.log('Text:', text);
    console.log('Matches found:', matches.length);
    matches.forEach((m, i) => {
      console.log(`  Match ${i}: "${text.substring(m.start, m.end)}" at ${m.start}-${m.end}, color: ${m.bgColor}`);
    });

    // Should only have ONE match for "Remote (US)" in red
    expect(matches.length).toBe(1);

    // Verify it's the longest phrase that matched
    const match = matches[0];
    expect(text.substring(match.start, match.end)).toBe('Remote (US)');
    expect(match.bgColor).toBe('#ff0000'); // red color
    // Don't check exact position, just that we got the right match
  });

  it('should match multiple occurrences correctly prioritizing longest matches', () => {
    const phraseMap = new Map<string, {bgColor: string, textColor: string}>([
      ['remote', { bgColor: '#00ff00', textColor: '#000000' }],
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],
    ]);

    // Text with both a compound phrase and separate occurrences
    const text = 'Remote (US) position, also remote work in US available';

    const matches = findMatches(text, phraseMap);

    // Should have 3 matches:
    // 1. "Remote (US)" at the start (red)
    // 2. "remote" in "remote work" (green)
    // 3. "US" standalone (blue)
    expect(matches.length).toBe(3);

    // First match should be the compound phrase
    expect(text.substring(matches[0].start, matches[0].end)).toBe('Remote (US)');
    expect(matches[0].bgColor).toBe('#ff0000');

    // Second match should be standalone "remote"
    expect(text.substring(matches[1].start, matches[1].end)).toBe('remote');
    expect(matches[1].bgColor).toBe('#00ff00');

    // Third match should be standalone "US"
    expect(text.substring(matches[2].start, matches[2].end)).toBe('US');
    expect(matches[2].bgColor).toBe('#0000ff');
  });

  it('should respect case sensitivity for all-uppercase phrases like "US"', () => {
    const phraseMap = new Map<string, {bgColor: string, textColor: string}>([
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],
    ]);

    // "US" should match (uppercase)
    const matches1 = findMatches('Located in US', phraseMap);
    expect(matches1.length).toBe(1);
    expect(matches1[0].bgColor).toBe('#0000ff');

    // "us" should NOT match (lowercase, and US is all-uppercase so case-sensitive)
    const matches2 = findMatches('Tell us more', phraseMap);
    expect(matches2.length).toBe(0);
  });

  it('should handle phrases with exact casing as stored, case-insensitively', () => {
    // This tests the exact scenario: phrases stored as entered
    const phraseMap = new Map<string, {bgColor: string, textColor: string}>([
      ['Remote', { bgColor: '#00ff00', textColor: '#000000' }],        // Stored as "Remote"
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],            // Stored as "US"
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],   // Stored as "Remote (US)"
    ]);

    const text = 'London, England, GB / Remote (US) - fulltime';
    const matches = findMatches(text, phraseMap);

    console.log('Test with exact casing:');
    console.log('Matches found:', matches.length);
    matches.forEach((m, i) => {
      console.log(`  Match ${i}: "${text.substring(m.start, m.end)}" at ${m.start}-${m.end}, color: ${m.bgColor}`);
    });

    // Should still only match "Remote (US)" in red
    expect(matches.length).toBe(1);
    expect(text.substring(matches[0].start, matches[0].end)).toBe('Remote (US)');
    expect(matches[0].bgColor).toBe('#ff0000');
  });

  it('should fail if matching shorter phrases instead of longest (EXPECTED FAILURE CASE)', () => {
    // This test demonstrates what the user is experiencing
    const phraseMap = new Map<string, {bgColor: string, textColor: string}>([
      ['remote', { bgColor: '#00ff00', textColor: '#000000' }],
      ['US', { bgColor: '#0000ff', textColor: '#ffffff' }],
      ['Remote (US)', { bgColor: '#ff0000', textColor: '#ffffff' }],
    ]);

    const text = 'London, England, GB / Remote (US) - fulltime';
    const matches = findMatches(text, phraseMap);

    // This assertion would fail if the algorithm was matching "Remote" and "US" separately
    // instead of "Remote (US)" as a whole
    if (matches.length !== 1) {
      console.log('BUG REPRODUCED! Found multiple matches instead of one longest match:');
      matches.forEach((m, i) => {
        console.log(`  Match ${i}: "${text.substring(m.start, m.end)}" at ${m.start}-${m.end}, color: ${m.bgColor}`);
      });
      throw new Error(`Expected 1 match but found ${matches.length}. This would be the bug!`);
    }

    // If we get here, the algorithm is working correctly
    expect(matches.length).toBe(1);
  });
});
