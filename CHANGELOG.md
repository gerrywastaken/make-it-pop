# Changelog

All notable changes to Make It Pop will be documented in this file.

## [1.0.5]

### Added
- Auto-request permissions when adding or updating domains (no more manual "Grant Permissions" step)... [931bef8](https://github.com/gerrywastaken/make-it-pop/commit/931bef8)

### Fixed
- Permission denial bug: extension now gracefully handles when users deny permission requests instead of getting stuck... [d3a2ea9](https://github.com/gerrywastaken/make-it-pop/commit/d3a2ea9)
- www. prefix bug: domains with www. prefix now correctly match permission patterns... [86cd5b7](https://github.com/gerrywastaken/make-it-pop/commit/86cd5b7)
- UI not updating after renaming a group... [7b12eb5](https://github.com/gerrywastaken/make-it-pop/commit/7b12eb5)
- Domain references not updating when group names change (domains using "only" or "except" group filters now stay in sync)... [ddf54c3](https://github.com/gerrywastaken/make-it-pop/commit/ddf54c3)

### Changed
- Centralized browser API calls for better maintainability... [d3a2ea9](https://github.com/gerrywastaken/make-it-pop/commit/d3a2ea9)
- Improved developer experience with web-ext for streamlined Firefox testing and fixed dev script to watch all entry points... [cccd5d2](https://github.com/gerrywastaken/make-it-pop/commit/cccd5d2), [da3e434](https://github.com/gerrywastaken/make-it-pop/commit/da3e434)

## [1.0.4]

### Fixed
- Export button and grant permissions button errors after code refactoring. Also added tests to prevent future regressions [#51](https://github.com/gerrywastaken/make-it-pop/pull/51)

## [1.0.3]

### Added
- Changelog documenting all version history with links to PRs and commits (yes, this thing you're reading right now)... [#35](https://github.com/gerrywastaken/make-it-pop/pull/35)
- User-controlled permission system with "all-sites" option for easier setup... [fbf3c1d](https://github.com/gerrywastaken/make-it-pop/commit/fbf3c1d)
- Manual permission request button for domains that need explicit permission... [21630fc](https://github.com/gerrywastaken/make-it-pop/commit/21630fc)
- Tray icon permission notification using optional host permissions... [2ce6e54](https://github.com/gerrywastaken/make-it-pop/commit/2ce6e54)
- Debug mode for troubleshooting issues (tap the version number 5 times in settings to unlock, like Android developer options)... [23cd7a8](https://github.com/gerrywastaken/make-it-pop/commit/23cd7a8)

### Changed
- Redesigned groups UI with single mode toggle, click-to-edit color controls, and minimal phrase tags for improved usability... [fe2ed63](https://github.com/gerrywastaken/make-it-pop/commit/fe2ed63)
- Groups now auto-save as you make changes (no more save/cancel buttons)... [6e8ab9a](https://github.com/gerrywastaken/make-it-pop/commit/6e8ab9a)
- Highlights now update instantly when you change settings in the popup (no page refresh needed)... [8a3c8e9](https://github.com/gerrywastaken/make-it-pop/commit/8a3c8e9)
- Improved button contrast and domain label spacing in settings page... [923b953](https://github.com/gerrywastaken/make-it-pop/commit/923b953)
- Improved developer experience with standalone UI development environment and Mozilla Add-ons automated upload workflows... [506e64a](https://github.com/gerrywastaken/make-it-pop/commit/506e64a), [903d40b](https://github.com/gerrywastaken/make-it-pop/commit/903d40b)

### Fixed
- Extension no longer freezes or slows down pages with lots of content (Firefox users were seeing "slowing down your browser" warnings)... [#47](https://github.com/gerrywastaken/make-it-pop/pull/47)
- Highlights no longer flicker back after unchecking a group in the popup... [04bc086](https://github.com/gerrywastaken/make-it-pop/commit/04bc086)
- Unchecking all groups now correctly removes all highlights... [8ca7bbd](https://github.com/gerrywastaken/make-it-pop/commit/8ca7bbd)
- Firefox permission request issues causing the extension to not work properly on some sites... [#34](https://github.com/gerrywastaken/make-it-pop/pull/34)
- Firefox compatibility for background script... [659a546](https://github.com/gerrywastaken/make-it-pop/commit/659a546)

## [1.0.2] - 2025-11-14

### Added
- User-friendly README with installation instructions... [#33](https://github.com/gerrywastaken/make-it-pop/pull/33)
- Direct link to Firefox Add-ons page... [68c0d63](https://github.com/gerrywastaken/make-it-pop/commit/68c0d63)
- One-click sample data for easy onboarding... [aac04cc](https://github.com/gerrywastaken/make-it-pop/commit/aac04cc)
- Self-documenting empty states to settings page... [1391b2a](https://github.com/gerrywastaken/make-it-pop/commit/1391b2a)

### Changed
- Updated sample data colors and removed group name default... [#32](https://github.com/gerrywastaken/make-it-pop/pull/32)
- Improved domain input user experience... [aac04cc](https://github.com/gerrywastaken/make-it-pop/commit/aac04cc)

## [1.0.1] - 2025-11-08 to 2025-11-13

### Added
- Privacy policy for browser store compliance... [#30](https://github.com/gerrywastaken/make-it-pop/pull/30)
- Comprehensive test suite for phrase matching logic... [#29](https://github.com/gerrywastaken/make-it-pop/pull/29)
- Test writing philosophy guide for future development... [dec6acf](https://github.com/gerrywastaken/make-it-pop/commit/dec6acf)
- Raw mode for phrase editing in group settings... [bfe8f78](https://github.com/gerrywastaken/make-it-pop/commit/bfe8f78)
- Case-sensitive matching for all-uppercase phrases... [6d43795](https://github.com/gerrywastaken/make-it-pop/commit/6d43795)
- Domain-specific popup (shows configuration for current site instead of global settings)... [20f9995](https://github.com/gerrywastaken/make-it-pop/commit/20f9995)
- Continuous Integration builds on all branches, releases only on main... [#25](https://github.com/gerrywastaken/make-it-pop/pull/25)
- Automatic version injection with git commit hash... [1e89a5c](https://github.com/gerrywastaken/make-it-pop/commit/1e89a5c)

### Fixed
- CPU spike and Garbage Collection pressure on dynamic sites like LinkedIn (made highlighting more efficient)... [#31](https://github.com/gerrywastaken/make-it-pop/pull/31) and [c6fc9c4](https://github.com/gerrywastaken/make-it-pop/commit/c6fc9c4)
- Dynamic content not being highlighted after initial page load... [cc51865](https://github.com/gerrywastaken/make-it-pop/commit/cc51865)
- Missing highlights on Single Page Application refreshes (sites that update without full page reload)... [0b3854a](https://github.com/gerrywastaken/make-it-pop/commit/0b3854a)
- Highlight color mismatch between settings preview and page highlights... [#27](https://github.com/gerrywastaken/make-it-pop/pull/27)
- Group filtering radio buttons not expanding in settings page... [#24](https://github.com/gerrywastaken/make-it-pop/pull/24)
- Drop shadow to use dark colors for both light and dark modes... [#19](https://github.com/gerrywastaken/make-it-pop/pull/19)
- Word boundary logic to match punctuation phrases like emdashes... [#17](https://github.com/gerrywastaken/make-it-pop/pull/17)
- Firefox warning about version_name in manifest... [7677a91](https://github.com/gerrywastaken/make-it-pop/commit/7677a91)
- Build artifact naming by sanitizing branch names... [cfa6e43](https://github.com/gerrywastaken/make-it-pop/commit/cfa6e43)

### Changed
- Redesigned popup with better domain configuration user experience... [#23](https://github.com/gerrywastaken/make-it-pop/pull/23)
- Unified desktop user interface with inline editing... [9846e8c](https://github.com/gerrywastaken/make-it-pop/commit/9846e8c)
- Simplified domain matching user experience with explicit match modes... [#22](https://github.com/gerrywastaken/make-it-pop/pull/22)
- Refactored version injection to use centralized version.ts file... [5f9c794](https://github.com/gerrywastaken/make-it-pop/commit/5f9c794)
- Refactored content.ts for better testability... [18709c5](https://github.com/gerrywastaken/make-it-pop/commit/18709c5)

## [1.0.0] - 2025-11-06 to 2025-11-08

### Added
- Initial release of Make It Pop browser extension
- Multi-word phrase highlighting with customizable color groups... [f9a424d](https://github.com/gerrywastaken/make-it-pop/commit/f9a424d)
- Light and dark mode support with separate color configurations... [#1](https://github.com/gerrywastaken/make-it-pop/pull/1) and [3e7b03e](https://github.com/gerrywastaken/make-it-pop/commit/3e7b03e)
- Domain pattern matching (e.g., `*.linkedin.com`)... [7564857](https://github.com/gerrywastaken/make-it-pop/commit/7564857)
- Flexible group filtering modes: all, only, except... [#8](https://github.com/gerrywastaken/make-it-pop/pull/8)
- Export/import configuration in JSON5 format (JSON with comments and trailing commas)... [#6](https://github.com/gerrywastaken/make-it-pop/pull/6)
- Extension popup with on/off toggle... [b921188](https://github.com/gerrywastaken/make-it-pop/commit/b921188)
- GitHub Continuous Integration workflow for automated builds and releases... [#4](https://github.com/gerrywastaken/make-it-pop/pull/4) and [#5](https://github.com/gerrywastaken/make-it-pop/pull/5)
- Make It Pop logo and icons... [#9](https://github.com/gerrywastaken/make-it-pop/pull/9), [#10](https://github.com/gerrywastaken/make-it-pop/pull/10), and [#11](https://github.com/gerrywastaken/make-it-pop/pull/11)

### Fixed
- Document Object Model race conditions with atomic splitText operations (prevented text corruption)... [#3](https://github.com/gerrywastaken/make-it-pop/pull/3)
- Page breakage by skipping unsafe elements... [efea928](https://github.com/gerrywastaken/make-it-pop/commit/efea928)
- React hydration conflicts by skipping React-managed trees... [d315721](https://github.com/gerrywastaken/make-it-pop/commit/d315721)
- Firefox Add-on validation errors and warnings... [#12](https://github.com/gerrywastaken/make-it-pop/pull/12), [#13](https://github.com/gerrywastaken/make-it-pop/pull/13), and [#14](https://github.com/gerrywastaken/make-it-pop/pull/14)
- Extension ID format for Firefox... [#15](https://github.com/gerrywastaken/make-it-pop/pull/15)
- Build permissions for release creation... [fd85528](https://github.com/gerrywastaken/make-it-pop/commit/fd85528)

[1.0.5]: https://github.com/gerrywastaken/make-it-pop/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/gerrywastaken/make-it-pop/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/gerrywastaken/make-it-pop/compare/v1.0.2-20251114-205559...v1.0.3
[1.0.2]: https://github.com/gerrywastaken/make-it-pop/compare/v1.0.1-20251113-172722...v1.0.2-20251114-205559
[1.0.1]: https://github.com/gerrywastaken/make-it-pop/compare/v1.0.0-20251108-135215...v1.0.1-20251113-172722
[1.0.0]: https://github.com/gerrywastaken/make-it-pop/releases/tag/v1.0.0-20251106-153915

---

## Changelog Philosophy

This changelog follows these principles:

**Auditability over vagueness**: Every entry links to the actual code (PR or commit) so you can see exactly what changed. If a description is unclear, you can always trace it to the source.

**Human-friendly language**: Technical terms are spelled out (not abbreviated) and explained when helpful. This is for users, not just developers.

**Versioning**: Version bumps reflect progress over time, not the size or "breakingness" of changes. A major version bump just means "enough time has passed and enough stuff has been merged" - it's a milestone, not a revolution.
