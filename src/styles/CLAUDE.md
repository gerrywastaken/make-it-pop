# CSS Style Guidelines

## Architecture

**Two-tier token system** - all colors flow through this:
```css
/* 1. Primitives: raw values, defined once */
--palette-green-500: #5cb88a;

/* 2. Semantic: meaning mapped to primitives */
--accent: var(--palette-green-500);
```

**File organization:**
- `shared.css` - tokens, base styles, reusable components
- `{page}.css` - page-specific layout and overrides

## Rules

### Always
- Use semantic tokens (`--text-color`) not primitives (`--palette-gray-900`)
- Use semantic tokens not raw hex values
- Use `rem`/`em` for spacing, `px` for borders
- Add `prefers-reduced-motion` when adding animations
- Touch targets: minimum 44px on mobile

### Never
- Hardcode colors - use design tokens
- Use `float` for layout - use flexbox/grid
- Use ID selectors for styling - use classes
- Skip focus states on interactive elements

## Patterns

**Dark mode:** Define once via `[data-theme="dark"]`, use `prefers-color-scheme` as fallback only.

**Buttons:** Use `.btn` + modifier (`.btn-primary`, `.btn-danger`, `.btn-small`).

**State classes:** `.active`, `.disabled`, `.editing`, `.visible`.

**Animations:** Define keyframes, reference via class, respect reduced-motion.

## Available Tokens

**Z-index scale:** `--z-sticky` (10), `--z-dropdown` (50), `--z-modal` (100), `--z-toast` (200)

**Transitions:** `--transition-fast` (0.15s), `--transition-normal` (0.2s), `--transition-slow` (0.3s)
