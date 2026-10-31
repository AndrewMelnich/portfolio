---
name: design-engineer
description: >
  ALWAYS use when writing or editing UI (markup, SCSS, component script,
  layout, motion, hover, scroll) — but not WebGL/WebGPU. Compositor-first
  motion + paint (transform/opacity), scroll scrub, cursor/runtime hot paths,
  section-driven header theme (data-header-theme). Also when fixing
  repaint/jank, sticky scrub grow/stretch, or tuning FPS during motion.
  Feature map + examples under references/features.md — open the matching
  example before coding that feature.
---

# Design engineer

Prefer **compositor properties** for anything that runs every frame (scroll, pointer, RAF). Layout (`width`/`height`/`top`/`left`) and paint-heavy color math (`color-mix` on text) stay off the hot path.

Scroll-linked progress wiring → skill `scroll-linked-animation`. Tokenized UI transitions → `transitions-dev` / `transitions-polish`.

**Feature map + how-to examples:** [references/features.md](references/features.md). Open the matching `examples/*.md` before coding that feature.

## Decision table

| Intent                      | Do this                                                      | Hot-path smell                                           | Example |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ------- |
| Grow / stretch / fullscreen | Fixed natural box + `scale` / `scaleY` (+ `translate3d`)     | Animating `height` / `width` / `inset`                   | [scale-stretch](examples/scale-stretch.md) |
| Fade in                     | `opacity`                                                    | `color-mix(... progress ...)` / animating `color`        | [fade-opacity](examples/fade-opacity.md) |
| Follow pointer              | `transform: translate3d(...)` on a promoted layer            | `left`/`top`, perpetual RAF while idle                   | [cursor-raf](examples/cursor-raf.md) |
| Restart a CSS transition    | `transition: none` → rAF → restore + class                   | `void el.offsetWidth` / forced reflow                    | [cursor-raf](examples/cursor-raf.md) |
| Read progress for a11y only | Geometry (`getBoundingClientRect`) + threshold gate          | `getComputedStyle` every frame; class toggle every frame | [js-hotpath](references/js-hotpath.md) |
| Scroll scrub progress       | CSS `view()` timeline; JS sets `--progress` only as fallback | Inline `--progress` while timeline is active             | [scroll-scrub](examples/scroll-scrub.md) |
| Header theme over a section | `data-header-theme` on bands + probe + class flip            | Page-class CSS; class rewrite every scroll; blend scrub  | [header-theme](examples/header-theme.md) |

## Size without layout

Keep the element's **layout size** at the rest state. Map progress to scale — full recipe: [examples/scale-stretch.md](examples/scale-stretch.md).

## Fade without paint thrash

Prefer `opacity: var(--appear)` — full recipe: [examples/fade-opacity.md](examples/fade-opacity.md).

## Runtime (JS)

1. **RAF only while needed** — start on show / scrub; stop when inactive and settled. Idle perpetual `requestAnimationFrame` is a tax.
2. **Cache** `matchMedia` / sticky `top` on resize; do not re-query every tick.
3. **Threshold sync** — toggle classes / `aria-*` only when the boolean flips.
4. **No style flush on hot path** — avoid `getComputedStyle`, `offsetWidth`, `offsetHeight` inside scroll/pointer/RAF loops.
5. **Passive** listeners: `{ passive: true }` on `scroll` / `mousemove`.

Canon: `features/cursor` (`cursor-runtime.ts`). Details: [references/js-hotpath.md](references/js-hotpath.md).

## Layers

- Promote with the transform you already use (`translateZ(0)` / `translate3d`).
- `will-change: transform` **only while active** (class), then drop — permanent `will-change` wastes memory.
- `contain: layout style` on floating UI (cursor root) when isolation is safe.

## Proof

jank / repaint fix → Chrome Performance while reproducing the gesture (Paint / Layout flashing). Motion change → `verify-ui` Motion probe when the path is user-visible. Header theme → recipe in [examples/header-theme.md](examples/header-theme.md).

## Deeper recipes

- [references/features.md](references/features.md) — feature map → examples
- [references/compositor.md](references/compositor.md) — transform vs layout, opacity vs color, sticky scrub sizing with `cqw`/`cqh`
- [references/js-hotpath.md](references/js-hotpath.md) — RAF gating, reflow-free transition restart, a11y sync

## Canon in this repo

| Pattern                                  | Where                           | Example |
| ---------------------------------------- | ------------------------------- | ------- |
| Header theme (`data-header-theme` probe) | `widgets/Header/model/header-theme.ts` | [header-theme](examples/header-theme.md) |
| Stretch via `scaleY`, fade via `opacity` | `widgets/Footer` talk           | [scale-stretch](examples/scale-stretch.md), [fade-opacity](examples/fade-opacity.md) |
| Showreel grow via `scale`                | `_pages/Index/.../Hero`         | [scale-stretch](examples/scale-stretch.md) |
| Cursor RAF + reflow-free reveal          | `features/cursor`               | [cursor-raf](examples/cursor-raf.md) |
| Scroll progress owner                    | `scroll-linked-animation` skill | [scroll-scrub](examples/scroll-scrub.md) |
