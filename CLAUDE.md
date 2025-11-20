# Make It Pop - Text Highlighting Extension

## Overview
A cross-browser (Chrome/Firefox) extension that highlights multi-word phrases on web pages using customizable color groups. Users can assign different phrase groups to specific domains with support for light/dark mode.

## Core Features

### 1. Groups
- Each group has:
  - Name (e.g., "Good phrases", "Bad phrases")
  - Enabled flag (global on/off toggle)
  - Light mode highlight color (background + text)
  - Dark mode highlight color (background + text)
  - List of multi-word phrases (case-insensitive)

### 2. Domains
- List of domains where extension runs
- Domain pattern support: `*.linkedin.com` matches `linkedin.com`, `www.linkedin.com`, `jobs.linkedin.com`, etc.
- Each domain has:
  - Domain pattern
  - Mode setting: "light" or "dark" (manual)
  - Group filtering (optional):
    - **Default**: Uses all enabled groups
    - **Only mode**: Uses only specified groups (e.g., `groups: ["Good", "Great"], groupMode: "only"`)
    - **Except mode**: Uses all groups except specified (e.g., `groups: ["DEI"], groupMode: "except"`)

### 3. Highlighting Behavior
- **Case-insensitive matching**: "Code Review" matches "code review", "CODE REVIEW", etc.
- **Exact match highlighting**: Only the matched portion is highlighted (not extra characters)
- **Longest match wins**: If "code" and "code review" both exist, "code review" takes precedence
- **Dynamic content**: MutationObserver watches for DOM changes with 3-second debounce
- **Performance**: Efficient text node traversal, avoid re-highlighting already processed text

### 4. Data Management
- **Storage**: chrome.storage.local (not synced)
- **Export/Import**: JSON export of all groups and domain configurations

## Technical Architecture

### Tech Stack
- **Language**: TypeScript
- **Build tool**: Vite
- **Target**: Manifest V3
- **Browsers**: Chrome, Firefox

### File Structure
```
makeitpop/
├── src/
│   ├── background.ts           # Background service worker (minimal, if needed)
│   ├── content.ts              # Main highlighting logic + MutationObserver
│   ├── settings/
│   │   ├── settings.html       # Settings page UI
│   │   ├── settings.ts         # Settings page logic
│   │   └── settings.css        # Settings page styles
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── storage.ts              # Storage helpers (get/set/export/import)
│   └── matcher.ts              # Phrase matching logic (longest match, etc.)
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── dist/                       # Build output (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md                   # This file
```

### Data Schema

```typescript
interface Group {
  id: string;                   // UUID
  name: string;
  enabled: boolean;             // Global on/off toggle
  lightBgColor: string;         // hex color for light mode background
  lightTextColor: string;       // hex color for light mode text
  darkBgColor: string;          // hex color for dark mode background
  darkTextColor: string;        // hex color for dark mode text
  phrases: string[];            // multi-word phrases
}

interface Domain {
  id: string;                   // UUID
  pattern: string;              // e.g., "*.linkedin.com" or "linkedin.com"
  mode: 'light' | 'dark';       // manual setting
  groups?: string[];            // Optional: group names (omit for "all enabled groups")
  groupMode?: 'only' | 'except'; // Optional: defaults to 'only' if groups specified
}

interface StorageData {
  groups: Group[];
  domains: Domain[];
}
```

### Key Components

#### 1. Content Script (`content.ts`)
- Runs on all pages initially, checks if current domain matches any configured patterns
- If match found:
  1. Fetches all groups and filters to enabled groups only
  2. Applies domain-specific group filtering:
     - No `groups` field → use all enabled groups
     - `groupMode: 'only'` → use only specified groups (that are also enabled)
     - `groupMode: 'except'` → use all enabled groups except specified
  3. Fetches domain mode (light/dark)
  4. Builds phrase-to-color map (using appropriate color for mode)
  5. Highlights all text nodes
  6. Sets up MutationObserver with 3-second debounce
- **Longest match algorithm**: Sort phrases by length (descending) before matching

#### 2. Settings Page (`settings/settings.ts`)
- CRUD for groups:
  - Create/edit/delete groups
  - Toggle enabled/disabled (checkbox per group)
  - Add/remove phrases
  - Set light/dark colors (background + text color pickers)
- CRUD for domains:
  - Add/edit/delete domain patterns
  - Set light/dark mode
  - Choose group filtering mode:
    - **All enabled groups** (default, no config needed)
    - **Only these groups** (select specific groups to include)
    - **All except these groups** (select specific groups to exclude)
- Export button: downloads JSON5 file
- Import button: uploads and validates JSON/JSON5 file

#### 3. Storage Helpers (`storage.ts`)
- `getGroups()`: Returns all groups
- `saveGroups(groups: Group[])`: Saves groups
- `getDomains()`: Returns all domains
- `saveDomains(domains: Domain[])`: Saves domains
- `exportData()`: Returns JSON string of all data
- `importData(json: string)`: Validates and imports data

#### 4. Phrase Matcher (`matcher.ts`)
- `buildMatchMap(groups: Group[], mode: 'light' | 'dark')`: Returns `Map<phrase, color>`
- `findMatches(text: string, matchMap: Map<phrase, color>)`: Returns array of `{start, end, color}` for a text string
  - Implements longest match wins
  - Case-insensitive
  - Returns exact character positions

#### 5. Domain Matcher (in `content.ts` or `matcher.ts`)
- `matchesDomain(pattern: string, hostname: string)`: boolean
  - `*.linkedin.com` matches `linkedin.com`, `www.linkedin.com`, `jobs.linkedin.com`
  - `linkedin.com` matches only `linkedin.com`

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Make It Pop",
  "version": "1.0.0",
  "description": "Highlight phrases on web pages with customizable color groups",

  "permissions": ["storage"],

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],

  "options_page": "settings/settings.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "browser_specific_settings": {
    "gecko": {
      "id": "makeitpop@sandegg.com"
    }
  }
}
```

### Build Process (Vite)
- Compile TypeScript to JavaScript
- Bundle content script, settings page script
- Copy static assets (manifest.json, HTML, CSS, icons)
- Output to `dist/` folder
- Dev mode: watch for changes, rebuild automatically

## Implementation Phases

### Phase 1: Foundation
- [x] Project setup (Vite + TypeScript)
- [ ] Data schema and storage helpers
- [ ] Basic settings page (no styling, just functional CRUD)
- [ ] Domain pattern matcher

### Phase 2: Highlighting
- [ ] Phrase matcher (longest match, case-insensitive)
- [ ] Content script: basic highlighting on page load
- [ ] Test with simple group/domain config

### Phase 3: Dynamic Content
- [ ] MutationObserver with 3-second debounce
- [ ] Avoid re-highlighting already highlighted text
- [ ] Performance testing on heavy DOM sites

### Phase 4: Polish
- [ ] Settings page styling (clean, usable UI)
- [ ] Export/import functionality
- [ ] Error handling (invalid JSON import, etc.)
- [ ] Icons and branding

### Phase 5: Cross-browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Fix any browser-specific issues

## Future Enhancements (Post-MVP)
- Popup UI for quick toggles
- Auto-detect light/dark mode
- Sync storage option
- Regex phrase support
- Per-phrase enable/disable
- Statistics (phrases found, pages highlighted)

## Development Notes

### Package Management (IMPORTANT)
**CRITICAL**: When adding, removing, or updating dependencies via `pnpm add`, `pnpm remove`, or `pnpm update`, you MUST commit both `package.json` AND `pnpm-lock.yaml` together. The CI environment uses `--frozen-lockfile` which will fail if these files are out of sync.

**Steps when changing dependencies:**
1. Run `pnpm add <package>` or `pnpm remove <package>`
2. Verify both `package.json` and `pnpm-lock.yaml` are modified
3. Commit BOTH files together: `git add package.json pnpm-lock.yaml`
4. Push changes

**If lockfile gets out of sync:**
- Run `pnpm install` to update `pnpm-lock.yaml`
- Commit the updated lockfile

### Longest Match Algorithm
```typescript
// Pseudocode
function findMatches(text: string, phrases: string[]): Match[] {
  // Sort phrases by length descending
  const sorted = phrases.sort((a, b) => b.length - a.length);
  const matches: Match[] = [];
  const lowerText = text.toLowerCase();

  let position = 0;
  while (position < text.length) {
    let matched = false;
    for (const phrase of sorted) {
      if (lowerText.startsWith(phrase.toLowerCase(), position)) {
        matches.push({ start: position, end: position + phrase.length, phrase });
        position += phrase.length;
        matched = true;
        break;
      }
    }
    if (!matched) position++;
  }

  return matches;
}
```

### Domain Pattern Matching
```typescript
function matchesDomain(pattern: string, hostname: string): boolean {
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.slice(2); // Remove '*.'
    // Match exact domain or any subdomain
    return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
  }
  return pattern === hostname;
}
```

### Highlighting with Mark.js or Custom
Options:
1. **Custom implementation**: Wrap matched text in `<mark>` or `<span>` with inline styles
2. **mark.js library**: Battle-tested, handles edge cases

Recommendation: Start with custom implementation (lighter weight), fall back to mark.js if edge cases become painful.

## Questions & Decisions

### Q: Should we support overlapping groups on same domain?
**A**: Yes. If both "Good phrases" and "Bad phrases" are assigned to linkedin.com, phrases from both groups are highlighted with their respective colors.

### Q: What if two phrases from different groups match at the same position?
**A**: Longest match wins first. If same length, first group (by order assigned to domain) wins.

### Q: Highlight style beyond background color?
**A**: Start with background color only. Future: add border, text color, bold, etc.

### Q: Should settings page show preview of colors?
**A**: Yes. Show color swatches next to color inputs.

---

**Last updated**: 2025-10-30
