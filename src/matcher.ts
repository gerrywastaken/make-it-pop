// Phrase matching logic - extracted for testability

export interface Match {
  start: number;
  end: number;
  bgColor: string;
  textColor: string;
}

// Check if a character is a word character (alphanumeric or underscore)
export function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

// Check if match is at a word boundary
// Only enforces boundaries if the phrase itself starts/ends with word characters
export function isWordBoundary(text: string, start: number, end: number, phrase: string): boolean {
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

// Check if a phrase is all uppercase (all letters in the phrase are uppercase)
// Phrases with no letters default to case-insensitive matching
export function isAllUppercase(phrase: string): boolean {
  const letters = phrase.match(/[a-zA-Z]/g);
  if (!letters || letters.length === 0) return false; // No letters, default to case-insensitive
  return letters.every(char => char === char.toUpperCase());
}

export function findMatches(text: string, phraseMap: Map<string, {bgColor: string, textColor: string}>): Match[] {
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
