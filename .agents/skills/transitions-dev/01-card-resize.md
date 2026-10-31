# Card resize

## When to use

Tweening a container's width or height when its layout state changes (compact ↔ expanded card, collapsing panel, list row toggling extra detail). Pure CSS — no JS required beyond the class toggle that drives the size change.

## HTML usage

```html
<div class="t-resize">…</div>
```

Put `.t-resize` on any element and change its width/height
(directly, or via a state class such as `.is-small`). The
transition will tween the two sizes.

## Tunable variables

| Variable | Default | Notes |
| --- | --- | --- |
| `--resize-dur` | `300ms` | sourced from `--p4-dur` |
| `--resize-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p4-ease` |

The `:root` defaults below match the live tuning on [transitions.dev](https://transitions.dev). Drop them into your global stylesheet once — every transition in this skill reads from semantic names like these, so multiple transitions can share a single `:root` block.

```css
:root {
  --resize-dur: 300ms;
  --resize-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

## CSS

```css
.t-resize {
  transition:
    width  var(--resize-dur) var(--resize-ease),
    height var(--resize-dur) var(--resize-ease);
  will-change: width, height;
}

@media (prefers-reduced-motion: reduce) {
  .t-resize { transition: none !important; }
}
```

The `@media (prefers-reduced-motion: reduce)` guard at the bottom of the snippet is required — keep it. It zeroes the transition for users who have asked for less motion at the OS level.

## Content width

The open size is the row's content when the child count is not a constant. Transition `width` from `calc-size(max-content, size)` to `0`. Put `width: max-content` on the same element so a browser that drops `calc-size()` still opens at the content size and still closes at `0`. Children of that row keep `flex-shrink: 0`. The clipping element has `overflow: hidden`. The child count stays out of `calc()`.

Chrome and Edge 129+ interpolate `calc-size()`. Firefox and Safari, as of October 2026, drop that declaration: the close still happens, the motion jumps. Say that support gap in one sentence and stop. Height disclosures stay on `grid-template-rows: 0fr` / `1fr` in [21-accordion.md](./21-accordion.md).

**Done:** the property in `transition` is the property the user named.

## Section file

In a page-section stylesheet the transition sits on the BEM element. Duration and easing are written on that transition. `prefers-reduced-motion` sits inside that same rule. The portable `.t-resize` class and `:root` block above stay in this snippet.

## JavaScript orchestration

None — pure CSS. Toggle the documented HTML attributes or class names from whatever already drives state in your app.

