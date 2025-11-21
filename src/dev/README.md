# UI Development Mode

This directory contains files for developing the settings UI in standalone mode without loading the full browser extension.

## Quick Start

```bash
pnpm dev:ui
```

Then open http://localhost:5173/dev/settings-dev.html in your browser.

## What's Included

- **browser-mock.ts** - Mocks `chrome.storage.local`, `chrome.permissions`, and `chrome.runtime` APIs with sample data
- **settings-dev.html** - Dev entry point that loads mocks before the settings code
- **version.ts** - Mock version constants for dev mode

## Features

- ⚡ Hot reload for CSS and TypeScript changes
- 📦 Pre-populated with mock data (3 groups, 2 domains)
- 🎨 Visual dev banner to indicate dev mode
- 💾 All storage operations work in-memory (won't affect real extension data)
- 🔐 Permission requests show alerts instead of browser dialogs

## Mock Data

The mock includes:
- 3 sample groups (Key Terms, Important Actions, Positive Indicators)
- 2 sample domains (github.com, example.com)
- Mix of enabled/disabled groups
- Different group filtering modes

Edit `browser-mock.ts` to customize the initial mock data.
