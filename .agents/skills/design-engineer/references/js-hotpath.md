# JS hot path

## RAF gate

```ts
const startTick = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};

const tick = () => {
  // lerp / paint
  if (isActive) {
    raf = requestAnimationFrame(tick);
    return;
  }
  raf = 0;
};

// mousemove / scroll: update inputs; startTick only when active
```

Idle pages must not keep a forever loop.

## Reflow-free transition restart

```ts
root.classList.remove("is-active");
inner.style.transition = "none";

requestAnimationFrame(() => {
  inner.style.transition = "";
  root.classList.add("is-active");
});
```

Use instead of `void el.offsetWidth` to flush styles.

## A11y / class sync

```ts
const progress = progressFromScroll(); // geometry only
if (!useTimeline) root.style.setProperty("--progress", String(progress));

const active = progress >= THRESHOLD;
if (active !== lastActive) {
  lastActive = active;
  root.classList.toggle("is-active", active);
  // tabindex / aria only here
}
```

When CSS `view()` owns `--progress`, JS must not write that variable. Still OK to derive a boolean from the same scroll geometry for `aria-*`.

## Cache

- `matchMedia('(prefers-reduced-motion: reduce)')` once; read `.matches` in tick.
- Sticky `top` from `getComputedStyle` on resize, reuse in scroll math.
- `{ passive: true }` on high-frequency listeners.
