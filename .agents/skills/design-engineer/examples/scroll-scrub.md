# Scroll scrub

Progress tied to scroll. Wiring detail lives in skill `scroll-linked-animation` — this note is the design-engineer contract only.

## Rule

| Prefer | Avoid |
| --- | --- |
| CSS `animation-timeline: view()` / named view timeline | Inline `--progress` every scroll while the timeline is active |
| Map progress → `transform` / `opacity` | Map progress → `height` / `width` / `color-mix` |
| JS fallback sets `--progress` only when timeline unsupported | Dual writers (CSS + JS) fighting the same variable |

## Hot path

- Geometry for a11y / class thresholds: `getBoundingClientRect` + **toggle only on boolean flip**
- No `getComputedStyle` in the scroll handler
- Passive scroll listener; rAF-gate if JS must sample

## Canon

| Case | Owner |
| --- | --- |
| Progress wiring | `.agents/skills/scroll-linked-animation` |
| Size from progress | [scale-stretch](scale-stretch.md) |
| Fade from progress | [fade-opacity](fade-opacity.md) |
| Discrete chrome over a band | [header-theme](header-theme.md) (threshold class, not scrub) |

## Anti-patterns

- Treating header theme as a scrubbed `--progress` (use discrete `data-header-theme` probe instead)
- Writing `--progress` from JS while `@supports (animation-timeline: view())` path is live
