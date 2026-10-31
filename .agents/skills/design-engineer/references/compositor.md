# Compositor recipes

## Transform vs layout

| Layout (avoid on scrub)    | Compositor stand-in                    |
| -------------------------- | -------------------------------------- |
| `height` / `width` tween   | Fixed box + `scale` / `scaleY`         |
| `top` / `left` follow      | `translate3d(x, y, 0)`                 |
| `margin` / `padding` pulse | `scale` on inner; padding stays static |

Measure **rest** and **target** sizes once (or via `cqw`/`cqh` on a `container-type: size` sticky shell). Drive only the ratio:

```scss
--scale-y: calc(
  1 + max(0, var(--target-h) / var(--natural-h) - 1) * var(--progress)
);
transform: translateZ(0) scaleY(var(--scale-y));
```

Non-uniform fullscreen grow (compact → cover): fixed compact rect + `scale(sx, sy)` + `transform-origin: 0 0` (Hero showreel). Avoid mid-scrub `left` + `%` `width` — clips and layouts.

## Opacity vs color

| Paint-heavy                                   | Prefer                                      |
| --------------------------------------------- | ------------------------------------------- |
| `color-mix` / `rgba` tied to progress on text | `opacity` on a wrap that owns the ink color |
| Animating `background-color` every frame      | Opacity overlay, or discrete class at end   |

`opacity` and `transform` compose on the same element without layout.

## Sticky scrub sizing

Pin: `position: sticky; height: 100vh; container-type: size`.
Safe area for stretch target:

```scss
--safe-h: calc(100cqh - var(--header-height) - gutters);
```

Progress owner and `view()` wiring: skill `scroll-linked-animation`.
