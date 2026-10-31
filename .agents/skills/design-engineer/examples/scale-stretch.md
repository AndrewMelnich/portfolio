# Scale stretch

Grow / stretch / fullscreen without animating layout size.

## Rule

Layout box stays at the **rest** size. Map progress to `scale` / `scaleY` (+ `translate3d` / `translateZ(0)`).

```scss
.block__visual {
  --natural-h: /* rest height */;
  --target-h: /* end height */;
  --scale-y: calc(
    1 + max(0, var(--target-h) / var(--natural-h) - 1) * var(--stretch)
  );

  height: var(--natural-h);
  transform: translateZ(0) scaleY(var(--scale-y));
  transform-origin: center center;
  backface-visibility: hidden;
}
```

## Progress owner

Prefer CSS `animation-timeline: view()` (or named view timeline) writing `--stretch`. JS sets `--stretch` only as fallback — see skill `scroll-linked-animation` and example [scroll-scrub](scroll-scrub.md).

## Canon

| Case | Where |
| --- | --- |
| Talk wordmark stretch | `widgets/Footer` (`--footer-talk-stretch` → `scaleY`) |
| Showreel grow | `_pages/Index/.../Hero` (non-uniform `scale`) |

## Anti-patterns

- Animating `height` / `width` / `inset` / `top` on scrub
- Permanent `will-change: transform` (add only while active, then drop)
