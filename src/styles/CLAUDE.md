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

## Known Issues to Fix

These exist in the codebase - fix when touching nearby code:

1. **Hardcoded colors** in `.phrase-tag`, `.toggle-slider` - should use tokens
2. **Duplicate dark mode definitions** - `@media` and `[data-theme]` blocks are copy-pasted
3. **Missing z-index scale** - add `--z-sticky`, `--z-modal`, etc.
4. **Inconsistent transitions** - standardize on `--transition-fast: 0.15s`, `--transition-normal: 0.2s`
5. **No `prefers-reduced-motion`** - animations ignore user preference
