# Cursor RAF

Custom cursor / pointer follow on the compositor.

## Rule

1. Move with `transform: translate3d(...)` on a promoted layer — never `left` / `top`.
2. RAF **only while active** (pointer in bounds / visible). Idle pages keep `raf = 0`.
3. Restart CSS transitions with `transition: none` → rAF → restore + class — not `void el.offsetWidth`.
4. `will-change: transform` only under an active class; drop when idle.
5. `{ passive: true }` on `mousemove`.

## Skeleton

```ts
let raf = 0;

const startTick = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};

const tick = () => {
  // apply translate3d from last pointer sample
  if (isActive) {
    raf = requestAnimationFrame(tick);
    return;
  }
  raf = 0;
};

// mousemove: store x/y; startTick when active
```

## Canon

`features/cursor` (`cursor-runtime.ts`).

## Anti-patterns

- Perpetual `requestAnimationFrame` while the cursor is hidden
- `getComputedStyle` / layout reads inside the tick
- Driving position with layout properties
