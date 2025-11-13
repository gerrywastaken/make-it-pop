# Test Writing Philosophy

> *"Make the change easy, then make the easy change."* — Kent Beck

When writing tests, channel Kent Beck's philosophy: **tests should tell a simple, clear story that anyone can understand at a glance.**

## The Core Principle

Every test follows this pattern:
1. **Input**: Set up your data
2. **Run**: Execute the function
3. **Expect**: Compare the entire result

That's it. No intermediate checks, no explaining, no ceremony.

## What Great Tests Look Like

### ❌ Before: Verbose, Fragmented

```typescript
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
```

**Problems:**
- Magic hex codes (#ff0000 vs #00ff00 - which is which?)
- Repetitive substring extraction
- Three assertions instead of one
- Comments stating the obvious
- Can't see the expected result at a glance

### ✅ After: Clear, Simple Story

```typescript
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
```

**Why this is better:**
- Named constants (RED, GREEN, BLUE) are human-readable
- Helper function (`textAndColorPairs`) eliminates repetition
- One assertion shows the complete expected result
- The entire story fits on one screen
- No comments needed - the code speaks for itself

## Essential Techniques

### 1. Use Named Constants for Magic Values

```typescript
// At the top of your test file
const GREEN = { bgColor: '#00ff00', textColor: '#000000' };
const BLUE = { bgColor: '#0000ff', textColor: '#ffffff' };
const RED = { bgColor: '#ff0000', textColor: '#ffffff' };
```

Now humans can think "red" instead of "is #ff0000 the same as #ff0000?"

### 2. Create Helper Functions to Reduce Repetition

If you're writing the same thing 3+ times, make a helper:

```typescript
// Instead of: text.substring(match.start, match.end)
const textOf = (text: string, match: Match) => text.substring(match.start, match.end);

// Instead of comparing text, bgColor, textColor separately
const textAndColorPairs = (text: string, matches: Match[]) =>
  matches.map(m => ({
    text: textOf(text, m),
    color: { bgColor: m.bgColor, textColor: m.textColor }
  }));
```

### 3. One Assertion That Shows the Complete Picture

```typescript
// ❌ Not this - scattered information
expect(matches.length).toBe(3);
expect(textOf(text, matches[0])).toBe('Remote (US)');
expect(matches[0].bgColor).toBe(RED.bgColor);
expect(textOf(text, matches[1])).toBe('remote');
expect(matches[1].bgColor).toBe(GREEN.bgColor);
expect(textOf(text, matches[2])).toBe('US');
expect(matches[2].bgColor).toBe(BLUE.bgColor);

// ✅ This - see everything at once
expect(textAndColorPairs(text, matches)).toEqual([
  { text: 'Remote (US)', color: RED },
  { text: 'remote', color: GREEN },
  { text: 'US', color: BLUE },
]);
```

When the test fails, you immediately see what was expected vs what was received.

### 4. No Comments Stating the Obvious

```typescript
// ❌ Don't do this
// Input: Three phrases with different colors
const phraseMap: PhraseMap = new Map([...]);

// Run: Find matches
const matches = findMatches(text, phraseMap);

// Expect: Only ONE match for the longest phrase "Remote (US)" in red
expect(textAndColorPairs(text, matches)).toEqual([...]);

// ✅ Do this - the code is self-documenting
const phraseMap: PhraseMap = new Map([...]);
const matches = findMatches(text, phraseMap);
expect(textAndColorPairs(text, matches)).toEqual([...]);
```

The test name already explains what it does. The code should be clear enough without commentary.

## The "Table Test" Pattern

For testing multiple similar inputs, make it look like a table:

```typescript
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
```

You can see all the test cases in one list, and the expected result is the same for all.

## Tests Must Fight For Their Existence

Not all code needs tests. Every test must justify its existence by providing **clear net value**.

### ✅ Tests Worth Writing

These tests protect against real breakage:

1. **Core functionality** - "Does the main feature work at all?"
2. **Regression tests** - "Does the bug we just fixed stay fixed?"
3. **Stable contracts** - "Do our public APIs work as documented?"

Example: If your matcher should prioritize "code review" over "code", test that. If it breaks, users will notice immediately.

### ❌ Tests Not Worth Writing

These tests are noise that hides meaningful tests:

1. **Implementation details** - Testing HOW code works, not WHAT it does
   - ❌ "Does MutationObserver fire when DOM changes?"
   - ❌ "Is the cache being used?"
   - ❌ "Does the debounce function delay execution?"

2. **Already-tested behavior** - Redundant tests add maintenance cost without benefit
   - If matcher.test.ts already tests longest-match logic, don't test it again in integration tests

3. **Unstable internals** - Tests that break when you refactor
   - If you could swap MutationObserver for polling and the behavior is identical, you're testing the wrong thing

### The Hard Question

Before writing a test, ask: **"If I deleted this test, would I lose sleep?"**

- If yes → The test is protecting something valuable
- If no → The test is noise

**Example:**
- "If highlighting stops working on dynamic sites" → Would lose sleep → Write test
- "If we switch from MutationObserver to polling" → Wouldn't lose sleep → Don't test implementation

### When Manual Testing Is Better

Sometimes the right answer is **no automated test**:

- Code isn't designed to be testable (would require significant refactoring)
- The refactoring cost exceeds the test benefit
- Manual testing on real sites (like LinkedIn) provides better confidence
- The test would be so complex it becomes maintenance burden

**Remember:** Tests are tools, not goals. Don't write tests for test's sake.

## Testing Philosophy Checklist

Before committing a test, ask yourself:

- [ ] Can I see the complete expected result in one assertion?
- [ ] Am I using named constants instead of magic values?
- [ ] Have I extracted repeated code into helper functions?
- [ ] Does the test tell a clear story: input → run → expect?
- [ ] Could I remove all the comments and still understand what's being tested?
- [ ] If this test fails, will the error message show me exactly what's wrong?
- [ ] **Would I lose sleep if this test didn't exist?** ← The most important question

## Remember

> *"I'm not a great programmer; I'm just a good programmer with great habits."* — Kent Beck

Great tests aren't about being clever. They're about being **clear**.

Write tests so simple that your future self (at 2am, debugging a production issue) can understand them instantly.
