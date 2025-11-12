# Privacy Policy - Make It Pop

**Last Updated:** November 12, 2025

## Overview

Make It Pop is a browser extension that respects your privacy. This policy explains our approach to data handling.

## Data Collection

**We collect absolutely nothing.**

Make It Pop does not:
- Collect any personal information
- Track your browsing history
- Send data to external servers
- Use analytics or telemetry
- Share data with third parties

## Data Storage

All extension data is stored **locally on your device** using your browser's local storage API (`chrome.storage.local`). This includes:
- Your phrase groups and configurations
- Domain settings
- Color preferences

This data:
- **Never leaves your device** (local storage, not synced)
- Is only accessible by the extension on your browser
- Remains under your complete control

## User Control

You have full ownership and control of your data:
- **Export**: Download all your settings as a JSON file at any time
- **Import**: Restore settings from a previously exported file
- **Audit**: Review all stored data through your browser's developer tools

## Open Source & Auditable

Make It Pop is **fully open source**. You can:
- Review the complete source code
- Verify that no data collection occurs
- Audit how your data is stored and used
- Build the extension yourself from source

**Source code:** https://github.com/gerrywastaken/make-it-pop

**Key files to audit:**
- [Content script](https://github.com/gerrywastaken/make-it-pop/blob/main/src/content.ts) - Shows how phrases are highlighted (no external communication)
- [Storage helpers](https://github.com/gerrywastaken/make-it-pop/blob/main/src/storage.ts) - Shows how data is stored locally
- [Settings page](https://github.com/gerrywastaken/make-it-pop/blob/main/src/settings/settings.ts) - Shows settings management (export/import)
- [Manifest](https://github.com/gerrywastaken/make-it-pop/blob/main/public/manifest.json) - Shows requested permissions

## Third-Party Services

Make It Pop does not use any third-party services, APIs, or external dependencies that could access your data.

## Permissions

The extension requests only the permissions necessary for its functionality:
- **storage**: To save your groups and domain configurations locally on your device
- **Access to all websites** (`<all_urls>`): To read page content and check the current domain against your configured patterns, then highlight matching phrases

**What the extension does with this access:**
- Checks if the current domain matches any of your configured domain patterns
- Reads text content on matching pages to find and highlight your configured phrases
- All processing happens locally in your browser - nothing is sent elsewhere

**What the extension does NOT do:**
- Does not access your browsing history
- Does not communicate with external servers
- Does not access sensitive data like passwords or form inputs
- Does not track which pages you visit

## Changes to This Policy

If we ever change this privacy policy, we will:
- Update the "Last Updated" date above
- Publish changes in the extension's source repository
- Notify users through extension update notes (if significant changes occur)

## Contact

If you have questions about this privacy policy or data handling, please open an issue on our GitHub repository.

---

**Summary:** Make It Pop collects nothing, stores everything locally on your device, and gives you complete control over your data. You own it. Period.
