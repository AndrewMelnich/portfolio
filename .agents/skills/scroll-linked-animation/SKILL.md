---
name: scroll-linked-animation
description: >
  Scroll-linked / scrub / sticky progress: CSS view() timeline first,
  JS scroll fallback. Use when sticky scale, showreel scrub, parallax-like
  progress 0→1, animation-timeline, ScrollTimeline, or scroll-driven UI.
---

# Scroll-linked animation

Project pattern: **CSS `view()` timeline when supported, JS scroll only as fallback** — same split as `features/parallax`.

## Pick the range

| Case                                                         | Timeline subject                    | `animation-range`                        |
| ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------- |
| Element crosses the viewport (parallax)                      | the moving element (or its media)   | `cover 0% cover 100%`                    |
| Sticky scrub: tall track + `position: sticky; height: 100vh` | the **track** (named view timeline) | `entry 100% exit 0%` (pin start → unpin) |
| Custom window                                                | —                                   | JS fallback; match the formula below     |

Sticky: put `view-timeline-name` on the track, `timeline-scope` + `animation-timeline: <name>` on an ancestor that owns `--progress` (so children inherit). Anonymous `view()` on the sticky itself usually **does not** advance while pinned.

Range cheat sheet: [references/ranges.md](references/ranges.md).

## CSS (preferred)

1. Register progress if keyframes drive a custom property:

```scss
@property --block-progress {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@keyframes block-progress {
  from {
    --block-progress: 0;
  }

  to {
    --block-progress: 1;
  }
}
```

2. Wire timeline under `@supports (animation-timeline: view())`. Detect support the same way as parallax: `CSS.supports('animation-timeline: view()')`.

**Sticky scrub (named):**

```scss
.block {
  --block-progress: 0;
  timeline-scope: --block-scrub;

  @supports (animation-timeline: view()) {
    animation: block-progress linear both;
    animation-timeline: --block-scrub;
    animation-range: entry 100% exit 0%;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
}

.block__track {
  view-timeline-name: --block-scrub;
  view-timeline-axis: block;
}
```

**Cover scrub (anonymous):** see `app/css/components/_parallax.scss` — `animation-timeline: view(); animation-range: cover 0% cover 100%`.

3. Drive visuals from `--block-progress` (or keyframe `transform` directly like parallax). Prefer **`transform` / `opacity`**, not width/left/top layout — recipes in skill `design-engineer`. For grow-to-fullscreen: fixed compact box + `translate3d` + non-uniform `scale`, `transform-origin: 0 0`, size via `cqw`/`cqh` on a `container-type: size` sticky shell. Avoid `left + width` with `%` — clips mid-scrub.

4. Hover that also uses `transform`: put scrub on a wrapper, hover scale on the inner control — or fold progress into hover (`scale(calc(1.08 - 0.08 * var(--progress)))`).

## JS fallback

Run only when timeline unsupported **or** `prefers-reduced-motion: reduce` (hard 0/1).

```ts
const supportsViewTimeline = () =>
  typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");

const scrollProgress = (track: HTMLElement, sticky: HTMLElement) => {
  const stickyTop = parseFloat(getComputedStyle(sticky).top) || 0;
  const travel = track.offsetHeight - sticky.offsetHeight;
  if (travel <= 0) return 0;
  return Math.min(
    1,
    Math.max(0, (-track.getBoundingClientRect().top + stickyTop) / travel),
  );
};

// init:
if (!supportsViewTimeline() || prefersReducedMotion()) {
  const update = () => {
    const p = prefersReducedMotion()
      ? Number(scrollProgress(track, sticky) >= 1)
      : scrollProgress(track, sticky);
    root.style.setProperty("--block-progress", String(p));
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}
```

Do **not** set the CSS variable from JS when the view timeline is active — inline style wins and fights the animation.

## Reduced motion

- CSS: `animation: none` inside the same `@supports` block that enables the timeline.
- JS fallback: snap progress to `0` or `1`, no smooth scrub.
- Keep the end state reachable (full / collapsed), not stuck mid-tween.

## Proof

Scroll-linked change → `verify-ui` **Motion** probe on the moving target (`--motion`, exit 0). Route console clean. Headless `<video>` frames often look grey in screenshots — sample via canvas / `currentTime` if judging playback.

## Canon in this repo

| Pattern                                                             | Where                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| Cover parallax + JS fallback if no `view()`                         | `app/css/components/_parallax.scss`, `features/parallax` |
| Sticky showreel scrub (`--hero-showreel-progress`, transform scale) | `_pages/Index/.../Hero`                                  |
| Sticky footer talk scrub (`--footer-talk-progress`, appear/stretch) | `widgets/Footer`                                         |
