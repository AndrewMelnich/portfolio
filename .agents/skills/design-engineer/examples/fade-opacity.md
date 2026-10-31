# Fade opacity

Appear / scrub fade without paint thrash.

## Rule

```scss
// prefer
opacity: var(--appear);

// avoid on scrub / every-frame path
color: color-mix(in srgb, $ink calc(var(--appear) * 100%), transparent);
```

Discrete theme / hover color changes (class toggle) may use `color` + CSS `transition`. Continuous scroll progress must not drive `color-mix`.

## Progress owner

Same as [scroll-scrub](scroll-scrub.md): CSS timeline owns `--appear` when possible; JS fallback writes the variable only when the timeline is unavailable.

## Canon

Footer talk fill / title fade via `--appear` → `opacity` (`widgets/Footer`).

## Anti-patterns

- `color-mix(... var(--progress) ...)` on a scrubbed text layer
- Toggling visibility classes every scroll frame instead of opacity on a promoted layer
