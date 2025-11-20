# Build Instructions for Mozilla Reviewers

This extension is built using a fully automated and transparent build process on GitHub Actions.

## Quick Start

```bash
# Install pnpm (if not already installed)
npm install -g pnpm@10

# Install dependencies
pnpm install --frozen-lockfile

# Run tests
pnpm test -- --run

# Build the extension
pnpm run build
```

The built extension will be in the `dist/` directory.

## Requirements

- Node.js 20.x
- pnpm 10.x

## Build Process

1. **Dependencies**: All dependencies are locked in `pnpm-lock.yaml`
2. **TypeScript Compilation**: Source code in `src/` is compiled using Vite
3. **Bundling**: Vite bundles the TypeScript into JavaScript
4. **Output**: Final extension files are placed in `dist/`

## Verification

Every release includes:
- Link to the exact GitHub commit
- Link to the GitHub Actions build logs
- The build artifact produced by CI

You can verify the build by:
1. Checking out the tagged commit
2. Running the build commands above
3. Comparing the output with the submitted extension

## Public Build Pipeline

All builds are performed on GitHub Actions and are publicly viewable:
https://github.com/gerrywastaken/make-it-pop/actions

Each release includes a link to the specific build that produced it.
