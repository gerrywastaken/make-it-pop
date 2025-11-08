// Test script for emdash matching logic
// Run with: node test-emdash.js

// Copy of the matching logic from content.ts
function isWordChar(char) {
  return /\w/.test(char);
}

function isWordBoundary(text, start, end, phrase) {
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

function findMatches(text, phraseMap) {
  const phrases = Array.from(phraseMap.keys()).sort((a, b) => b.length - a.length);
  const matches = [];
  const lowerText = text.toLowerCase();

  let position = 0;
  while (position < text.length) {
    let matched = false;
    for (const phrase of phrases) {
      const lowerPhrase = phrase.toLowerCase();
      if (lowerText.startsWith(lowerPhrase, position)) {
        const end = position + phrase.length;
        // Check word boundaries
        if (isWordBoundary(text, position, end, phrase)) {
          const colors = phraseMap.get(phrase);
          matches.push({
            start: position,
            end: end,
            bgColor: colors.bgColor,
            textColor: colors.textColor,
            matchedText: text.slice(position, end)
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

// Test cases
console.log('=== Testing Emdash Matching ===\n');

const phraseMap = new Map([
  ['—', { bgColor: 'yellow', textColor: 'black' }],
  ['therefore', { bgColor: 'red', textColor: 'white' }]
]);

// Test 1: Emdash with no spaces (from user's example)
const text1 = 'to cultivate moral discernment as a fundamental part of their work—to develop systems';
console.log('Test 1: Emdash with no spaces');
console.log('Text:', text1);
const matches1 = findMatches(text1, phraseMap);
console.log('Matches found:', matches1.length);
matches1.forEach(m => {
  console.log(`  - "${m.matchedText}" at position ${m.start}-${m.end}`);
});
console.log('Expected: 1 match for "—"');
console.log('Result:', matches1.length === 1 && matches1[0].matchedText === '—' ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 2: Emdash with space after (should also work)
const text2 = 'Emdash spotted — here';
console.log('Test 2: Emdash with space after');
console.log('Text:', text2);
const matches2 = findMatches(text2, phraseMap);
console.log('Matches found:', matches2.length);
matches2.forEach(m => {
  console.log(`  - "${m.matchedText}" at position ${m.start}-${m.end}`);
});
console.log('Expected: 1 match for "—"');
console.log('Result:', matches2.length === 1 && matches2[0].matchedText === '—' ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 3: Word matching should still work (with word boundaries)
const text3 = 'The Church therefore calls all builders';
console.log('Test 3: Word matching with boundaries');
console.log('Text:', text3);
const matches3 = findMatches(text3, phraseMap);
console.log('Matches found:', matches3.length);
matches3.forEach(m => {
  console.log(`  - "${m.matchedText}" at position ${m.start}-${m.end}`);
});
console.log('Expected: 1 match for "therefore"');
console.log('Result:', matches3.length === 1 && matches3[0].matchedText === 'therefore' ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 4: Word should NOT match when embedded in another word
const text4 = 'thereforesomething';
console.log('Test 4: Word should NOT match when embedded');
console.log('Text:', text4);
const matches4 = findMatches(text4, phraseMap);
console.log('Matches found:', matches4.length);
matches4.forEach(m => {
  console.log(`  - "${m.matchedText}" at position ${m.start}-${m.end}`);
});
console.log('Expected: 0 matches');
console.log('Result:', matches4.length === 0 ? '✓ PASS' : '✗ FAIL');
console.log();

// Test 5: Full text from user's example
const text5 = 'Technological innovation can be a form of participation in the divine act of creation. It carries an ethical and spiritual weight, for every design choice expresses a vision of humanity. The Church therefore calls all builders of #AI to cultivate moral discernment as a fundamental part of their work—to develop systems that reflect justice, solidarity, and a genuine reverence for life.';
console.log('Test 5: Full text from user example');
console.log('Text: [full paragraph]');
const matches5 = findMatches(text5, phraseMap);
console.log('Matches found:', matches5.length);
matches5.forEach(m => {
  console.log(`  - "${m.matchedText}" at position ${m.start}-${m.end}`);
});
console.log('Expected: 2 matches (1 for "therefore", 1 for "—")');
console.log('Result:', matches5.length === 2 ? '✓ PASS' : '✗ FAIL');
console.log();

console.log('=== Test Summary ===');
const allPassed = matches1.length === 1 && matches1[0].matchedText === '—' &&
                   matches2.length === 1 && matches2[0].matchedText === '—' &&
                   matches3.length === 1 && matches3[0].matchedText === 'therefore' &&
                   matches4.length === 0 &&
                   matches5.length === 2;
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
