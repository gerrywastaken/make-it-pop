# UI Development Mode

This directory contains files for developing the extension UI in standalone mode without loading the full browser extension.

## Quick Start

```bash
pnpm dev:ui
```

Your browser will automatically open to the **UI Launcher** at http://localhost:5173/dev/index.html where you can choose which UI to test.

Direct links:
- **UI Launcher**: http://localhost:5173/dev/index.html
- **Popup UI**: http://localhost:5173/dev/popup-dev.html
- **Settings UI**: http://localhost:5173/dev/settings-dev.html

## What's Included

- **index.html** - UI launcher with links to all dev UIs
- **browser-mock.ts** - Mocks `chrome.storage.local`, `chrome.permissions`, `chrome.runtime`, and `chrome.tabs` APIs with sample data
- **popup-dev.html** - Dev entry point for testing the popup UI
- **settings-dev.html** - Dev entry point for testing the settings page
- **version.ts** - Mock version constants for dev mode

Each dev page includes navigation links in the dev banner to easily switch between UIs.

## Features

- 🏠 UI launcher to easily switch between different dev UIs
- ⚡ Hot reload for CSS and TypeScript changes
- 📦 Pre-populated with mock data (3 groups, 2 domains)
- 🎨 Visual dev banner with navigation to other UIs
- 💾 All storage operations work in-memory (won't affect real extension data)
- 🔐 Permission requests show alerts instead of browser dialogs

## Mock Data

The mock includes:
- 3 sample groups (Key Terms, Important Actions, Positive Indicators)
- 2 sample domains (github.com, example.com)
- Mix of enabled/disabled groups
- Different group filtering modes

Edit `browser-mock.ts` to customize the initial mock data.
