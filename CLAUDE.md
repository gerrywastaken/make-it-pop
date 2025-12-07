# Make It Pop - Text Highlighting Extension

## Overview
A cross-browser (Chrome/Firefox) extension that highlights multi-word phrases on web pages using customizable color groups. Users can assign different phrase groups to specific domains with support for light/dark mode.

CRITICAL: Pre-PR Checklist

Before providing ANY PR creation commands (gh pr create or PR links):

    REBASE: git fetch origin main && git rebase origin/main && git push --force-with-lease
    See Pull Request Workflow for fixup/squash decisions

Why: A PR outdated at inception is pointless. See PR Workflow section for full reasoning.

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

### Development URLs

When running `pnpm dev:ui`, the Vite dev server runs on `http://localhost:5173` with `src/` as the root directory.

**Always use the `/dev/` URLs for development:**
- ✅ **`http://localhost:5173/dev/settings-dev.html`** - Settings UI with mocked browser APIs and sample data
- ✅ **`http://localhost:5173/dev/popup-dev.html`** - Popup UI with mocked browser APIs

**Do NOT use production files directly in dev server:**
- ❌ ~~`http://localhost:5173/settings/settings.html`~~ - Production file (no mocks, will show empty/broken)
- ❌ ~~`http://localhost:5173/popup/popup.html`~~ - Production file (no mocks, will show empty/broken)

**Why:** The `/dev/*-dev.html` files are development wrappers that:
1. Load `/dev/browser-mock.ts` first (mocks `chrome`/`browser` APIs, provides sample data)
2. Then load the actual component files (`/settings/settings.ts`, etc.)

The production files (`/settings/settings.html`, `/popup/popup.html`) are built into the browser extension and use real browser APIs.

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
- [x] Data schema and storage helpers
- [x] Basic settings page (no styling, just functional CRUD)
- [x] Domain pattern matcher

### Phase 2: Highlighting
- [x] Phrase matcher (longest match, case-insensitive)
- [x] Content script: basic highlighting on page load
- [x] Test with simple group/domain config

### Phase 3: Dynamic Content
- [x] MutationObserver with 3-second debounce
- [x] Avoid re-highlighting already highlighted text
- [x] Performance testing on heavy DOM sites

### Phase 4: Polish
- [x] Settings page styling (clean, usable UI)
- [x] Export/import functionality
- [x] Error handling (invalid JSON import, etc.)
- [x] Icons and branding

### Phase 5: Cross-browser Testing
- [x] Test in Chrome
- [x] Test in Firefox
- [x] Fix any browser-specific issues

## Future Enhancements (Post-MVP)
- [x] Popup UI for quick toggles
- [ ] Auto-detect light/dark mode
- [ ] Sync storage option
- [ ] Regex phrase support
- [ ] Statistics (phrases found, pages highlighted)

## Development Notes

## Pull Request Workflow

**Core Principle:** Keep main's git history clean and atomic while preserving review context during the PR process.

**Why this matters:**
- Fixup commits let you refine work-in-progress commits before they land on main
- During review, stable commit history is essential - GitHub's review interface depends on it
- Autosquashing rewrites history, which breaks: comment anchoring, incremental review flow, and collaboration between reviewers
- Only after review is complete should commits be cleaned up via autosquash for a clean main history

When creating a pull request:

1. Use fixup commits appropriately - for refining unmerged commits:
   * Use fixup when: Making corrections to a commit that exists on the current unmerged branch
     - Example: Forgot to add a test for the code you just committed → `git commit --fixup=<hash>`
     - Example: Typo or bug in code from a previous commit on this branch → `git commit --fixup=<hash>`
     - Example: Reverting a mistake from this branch → `git revert -n <hash> && git commit --fixup=<hash>`
   - **Use regular commit when:** Adding new logical work, even if related
     - Example: First commit fixes a code bug, then discover deployment config also needs updating → regular commit
     - Example: Different file, different concern, or new issue discovered → regular commit
   - **Rule of thumb:** Fixup is for perfecting commits before merge. If it's new work or a separate concern, use a regular commit.
   - **During review:** Fixup commits are fine for addressing reviewer feedback. The stable commit hashes are what matters - don't autosquash until review is complete.

2. **Check branch is up-to-date with main before PR creation:**
   - Always rebase onto latest main before providing the PR creation link
   - A PR that's outdated at inception is pointless
   ```bash
   git fetch origin main && git rebase origin/main
   git push --force-with-lease
   ```

3. **Create or provide PR creation information:**
   - **When the user explicitly asks you to create a PR** (e.g., "create a pr", "make a pull request"): Run the `gh pr create` command directly using the Bash tool with a HEREDOC for proper formatting
   - **Otherwise**: Provide a concise PR description following this format:

   <example>
   To checkout locally:
   ```bash
   git fetch origin BRANCH_NAME
   git checkout BRANCH_NAME
   ```

   To create PR via CLI:
   ```bash
   gh pr create --head BRANCH_NAME --base main --title "Fix TAILSCALE_HOSTNAME configuration" --body "$(cat <<'EOF'
Fixes 502 errors on /raw routes by properly configuring TAILSCALE_HOSTNAME.

**Why:** Hardcoded hostname violated fail-fast principles and caused silent failures.
EOF
)"
   ```

   or [create pr](https://github.com/gerrywastaken/REPO/pull/new/BRANCH_NAME)
   </example>

4. **Before merge, rebase with autosquash to clean up fixup commits:**
   ```bash
   git fetch origin main && git rebase -i --autosquash origin/main
   git push --force-with-lease
   ```
   **ONLY do this when the user explicitly asks you to clean up commits. Never do this automatically - the user decides when review is complete.**

This ensures the PR is clean, well-documented, and ready for review.

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
